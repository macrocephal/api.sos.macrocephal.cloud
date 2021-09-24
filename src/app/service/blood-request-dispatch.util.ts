import { v4 } from 'uuid';
import { Container } from '../../container';
import { BloodGroup } from '../model/blood-group';
import { BloodRequest } from '../model/blood-request';
import { BloodRequestDispatch } from '../model/blood-request-dispatch';
import { RhesusFactor } from '../model/rhesus-factor';
import { withRedis } from '../script/with-redis';
import { WithApplication } from '../with-application';

export class BloodRequestDispatchUtil extends WithApplication {
    #radius = [50_000, 'm'] as const;
    #maximum = 50 as const;

    constructor(container: Container) {
        super(container);
    }

    async dispatch(props: BloodRequestDispatchUtility.Props): Promise<BloodRequestDispatch> {
        switch (props.request.bloodGroup) {
            case BloodGroup.A:
                return this.#dispatchBloodGroupA(props);
            case BloodGroup.B:
                return this.#dispatchBloodGroupB(props);
            case BloodGroup.O:
                return this.#dispatchBloodGroupO(props);
            case BloodGroup.AB:
                return this.#dispatchBloodGroupAB(props);
            default:
                throw new Error(`Unsupported blood group: props.request.bloodGroup`);
        }
    }

    async #dispatchBloodGroupA(_props: BloodRequestDispatchUtility.Props): Promise<BloodRequestDispatch> {
        throw new Error('Not yet implemented');
    }

    async #dispatchBloodGroupB(_props: BloodRequestDispatchUtility.Props): Promise<BloodRequestDispatch> {
        throw new Error('Not yet implemented');
    }

    async #dispatchBloodGroupO(props: BloodRequestDispatchUtility.Props): Promise<BloodRequestDispatch> {
        const dispatchId = v4();
        const NEIGHBOURHOOD = `tmp:neigbourhood:${dispatchId}`;
        const COORDINATES = this.key.donors.blood.coordinates();
        const GROUP_O = this.key.donors.blood.group(props.request.bloodGroup);
        const RHESUS = this.key.donors.blood.rhesus(props.request.rhesusFactor);
        const DISPATCH_O = `tmp:dispatch-matches:blood:${dispatchId}:${props.request.bloodGroup}`;
        const REQUEST_O = `tmp:request-matches:blood:${props.request.id}:${props.request.bloodGroup}`;
        const DISPATCH_O_RHESUS = `tmp:dispatch-matches:blood:${dispatchId}:${props.request.bloodGroup}:${props.request.rhesusFactor}`;
        const REQUEST_O_RHESUS = `tmp:request-matches:blood:${props.request.id}:${props.request.bloodGroup}:${props.request.rhesusFactor}`;

        await this.redis.send_command('GEORADIUS', COORDINATES, props.longitude, props.latitude, ...this.#radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_O_RHESUS, 3, NEIGHBOURHOOD, GROUP_O, RHESUS);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_RHESUS, DISPATCH_O_RHESUS, REQUEST_O_RHESUS, REQUEST_O);
        await this.redis.zrem(DISPATCH_O_RHESUS, props.userId);
        await this.redis.zunionstore(REQUEST_O_RHESUS, 2, REQUEST_O_RHESUS, DISPATCH_O_RHESUS);

        if (RhesusFactor.POSITIVE === props.request.rhesusFactor &&
            this.#maximum > await Promise.all([
            this.redis.zcard(REQUEST_O),
            this.redis.zcard(REQUEST_O_RHESUS),
        ]).then(([a, b]) => +a + b)) {
            await this.redis.zinterstore(DISPATCH_O, 2, NEIGHBOURHOOD, GROUP_O);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O, DISPATCH_O, REQUEST_O_RHESUS, REQUEST_O);
            await this.redis.zrem(DISPATCH_O, props.userId);
            await this.redis.zunionstore(REQUEST_O, 2, REQUEST_O, DISPATCH_O);
        }

        const dispatch = await Promise.all([
            this.redis.zrange(DISPATCH_O, 0, -1, 'WITHSCORES').then(this.#matchesCollector),
            this.redis.zrange(DISPATCH_O_RHESUS, 0, -1, 'WITHSCORES').then(this.#matchesCollector),
        ]).then<BloodRequestDispatch>(([o, oRhesus]) => this.#dispatchesCollector(
            props.request.id, dispatchId,
            [[props.request.bloodGroup, '*'], o],
            [[props.request.bloodGroup, props.request.rhesusFactor], oRhesus]));

        await this.redis.del(NEIGHBOURHOOD, DISPATCH_O_RHESUS, DISPATCH_O);

        return dispatch;
    }

    async #dispatchBloodGroupAB(_props: BloodRequestDispatchUtility.Props): Promise<BloodRequestDispatch> {
        throw new Error('Not yet implemented');
    }

    #dispatchesCollector(requestId: string, dispatchId: string,
        ...rawDispatches: [keys: [BloodGroup, RhesusFactor | '*'], matches: Record<string, number>][]): BloodRequestDispatch {
        const dispatch = rawDispatches.reduce((dispatch, [[group, rhesus = '*'], matches]) => {
            if (0 < Object.keys(matches).length) {
                if (!dispatch.outcome) dispatch.outcome ?? {};
                if (!dispatch.outcome![group]) dispatch.outcome![group] = {};
                if (!dispatch.outcome![group]![rhesus]) dispatch.outcome![group]![rhesus] = matches;
            }
            return dispatch;
        }, { requestId, id: dispatchId, createdAt: Date.now() } as BloodRequestDispatch);

        return dispatch;
    }

    #matchesCollector(matches: string[]) {
        return matches.reduce<Record<string, number>>((hay, matchOrDistiance, index) =>
            0 === index % 2 ? hay : {
                ...hay,
                [matches[index - 1] as string]: +matchOrDistiance,
            }, {});
    }
}

export namespace BloodRequestDispatchUtility {
    export interface Props {
        request: BloodRequest;
        longitude: number;
        latitude: number;
        userId: string;
    }
}
