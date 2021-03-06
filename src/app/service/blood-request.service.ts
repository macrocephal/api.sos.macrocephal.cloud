import { v4 } from 'uuid';
import { BloodGroup } from '../model/blood-group';
import { RhesusFactor } from '../model/rhesus-factor';
import { Container } from './../../container';
import { BloodRequest } from './../model/blood-request';
import { BloodRequestDispatch } from './../model/blood-request-dispatch';
import { WithApplication } from './../with-application';
import { ANegativeBloodRequestDispatch } from './blood-request-dispatch/a-negative-blood-request-dispatch.strategy';
import { APositiveBloodRequestDispatch } from './blood-request-dispatch/a-positive-blood-request-dispatch.strategy';
import { ABNegativeBloodRequestDispatch } from './blood-request-dispatch/ab-negative-blood-request-dispatch.strategy';
import { ABPositiveBloodRequestDispatch } from './blood-request-dispatch/ab-positive-blood-request-dispatch.strategy';
import { BNegativeBloodRequestDispatch } from './blood-request-dispatch/b-negative-blood-request-dispatch.strategy';
import { BPositiveBloodRequestDispatch } from './blood-request-dispatch/b-positive-blood-request-dispatch.strategy';
import { BaseBloodRequestDispatchStrategy } from './blood-request-dispatch/base-blood-request-dispatch.strategy';
import { BloodRequestDispatchStrategy } from './blood-request-dispatch/blood-request-dispatch.strategy';
import { ONegativeBloodRequestDispatch } from './blood-request-dispatch/o-negative-blood-request-dispatch.strategy';
import { OPositiveBloodRequestDispatch } from './blood-request-dispatch/o-positive-blood-request-dispatch.strategy';

export class BloodRequestService extends WithApplication {
    #bloodRequestDispatches: FirebaseFirestore.CollectionReference<BloodRequestDispatch> = void 0 as any;
    #bloodRequests: FirebaseFirestore.CollectionReference<BloodRequest> = void 0 as any;

    constructor(container: Container) {
        super(container);
        this.init = (async (init) => {
            await init;
            this.#bloodRequestDispatches = this.firebase.firestore().collection('dispatches:blood')
                .withConverter<BloodRequestDispatch>({
                    fromFirestore: snapshot => snapshot.data() as BloodRequestDispatch,
                    toFirestore: model => model,
                });
            this.#bloodRequests = this.firebase.firestore().collection('requests:blood')
                .withConverter<BloodRequest>({
                    fromFirestore: snapshot => snapshot.data() as BloodRequest,
                    toFirestore: model => model,
                });
        })(this.init);
    }

    async search(userId: string, requestId: string): Promise<BloodRequest> {
        const request = (await this.#bloodRequests
            .where('id', '==', requestId)
            .where('userId', '==', userId)
            .get()).docs[0]?.data();

        if (!request) {
            const error = new Error(`Blood request not found: ${requestId} [userId=${userId}]`);

            error.name = WithApplication.ERROR_NOT_FOUND;

            throw error;
        }

        return request;
    }

    async create(userId: string, payload: { bloodGroup: BloodGroup, rhesusFactor: RhesusFactor, longitude: number, latitude: number }): Promise<BloodRequest> {
        const { rhesusFactor, bloodGroup, longitude, latitude } = payload;
        this.logger.debug('BloodRequestService.create <<< ', ...arguments);
        const request: BloodRequest = { rhesusFactor, bloodGroup, createdAt: Date.now(), active: true, id: v4(), userId };

        await this.#bloodRequests.doc(request.id).set(request, { merge: false });

        try {
            await this.dispatch(userId, request.id, { longitude, latitude });
        } catch (error: any) {
            await this.#bloodRequests.doc(request.id).delete();
            error.name = WithApplication.ERROR_CONFLICT;
            throw error;
        }

        this.logger.debug('BloodRequestService.create >>> ', request);
        return request;
    }

    async dispatch(userId: string, requestId: string, payload: { longitude: number, latitude: number }): Promise<BloodRequestDispatch> {
        this.logger.debug('BloodRequestService.dispatch <<< ', ...arguments);
        const request = await this.search(userId, requestId);

        if (!request.active) {
            const error = new Error(`Blood request not active: ${requestId}`);

            error.name = WithApplication.ERROR_CONFLICT;

            throw error;
        }

        // TODO: pull all dispatches for this request, merge them and hydrate Redis
        const strategy = await this.#resolveStrategy(request);

        // const strategy = await BaseBloodRequestDispatchStrategy.resolve(request, this.container);
        const dispatch = await strategy.dispatch([request, payload.longitude, payload.latitude]);

        await this.#bloodRequestDispatches.doc(dispatch.id).set(dispatch, { merge: false });
        // TODO: send notifications to matches for this last dispatch

        this.logger.debug('BloodRequestService.dispatch >>> ', dispatch);
        return dispatch;
    }

    async #resolveStrategy(request: BloodRequest): Promise<BloodRequestDispatchStrategy> {
        const resolve = BaseBloodRequestDispatchStrategy.resolve.bind(BaseBloodRequestDispatchStrategy);

        switch (request.bloodGroup) {
            case BloodGroup.A:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? await resolve(this.container, ANegativeBloodRequestDispatch)
                    : await resolve(this.container, APositiveBloodRequestDispatch);
            case BloodGroup.B:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? await resolve(this.container, BNegativeBloodRequestDispatch)
                    : await resolve(this.container, BPositiveBloodRequestDispatch);
            case BloodGroup.O:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? await resolve(this.container, ONegativeBloodRequestDispatch)
                    : await resolve(this.container, OPositiveBloodRequestDispatch);
            case BloodGroup.AB:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? await resolve(this.container, ABNegativeBloodRequestDispatch)
                    : await resolve(this.container, ABPositiveBloodRequestDispatch);
            default:
                throw new Error(`Unsupported opperation yet [bloodGroup=${request.bloodGroup}] [rhesusFactor=${request.rhesusFactor}]`);
        };
    }

    async disable(userId: string, requestId: string): Promise<void> {
        this.logger.debug(`BloodRequestService.disable <<< [userId=${userId}] [requestId=${requestId}]`);
        const request = await this.search(userId, requestId);

        if (request.active) {
            await Promise.all([
                this.#bloodRequests.doc(request.id).update({ active: false }),
                this.redis.del(
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.A),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.A, RhesusFactor.NEGATIVE),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.A, RhesusFactor.POSITIVE),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.B),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.B, RhesusFactor.NEGATIVE),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.B, RhesusFactor.POSITIVE),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.O),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.O, RhesusFactor.NEGATIVE),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.O, RhesusFactor.POSITIVE),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.AB),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.AB, RhesusFactor.NEGATIVE),
                    BaseBloodRequestDispatchStrategy.key.donors.blood.request(request.id, BloodGroup.AB, RhesusFactor.POSITIVE),
                ),
            ]);
        }

        this.logger.debug(`BloodRequestService.disable >>> [userId=${userId}] [requestId=${requestId}]`);
    }
}
