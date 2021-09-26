import { BloodGroup } from '../../model/blood-group';
import { BloodRequest } from '../../model/blood-request';
import { RhesusFactor } from '../../model/rhesus-factor';
import { Container } from './../../../container';
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { WithApplication } from './../../with-application';
import { ANegativeBloodRequestDispatch } from './a-negative-blood-request-dispatch.strategy';
import { APositiveBloodRequestDispatch } from './a-positive-blood-request-dispatch.strategy';
import { ABNegativeBloodRequestDispatch } from './ab-negative-blood-request-dispatch.strategy';
import { ABPositiveBloodRequestDispatch } from './ab-positive-blood-request-dispatch.strategy';
import { BNegativeBloodRequestDispatch } from './b-negative-blood-request-dispatch.strategy';
import { BPositiveBloodRequestDispatch } from './b-positive-blood-request-dispatch.strategy';
import { BloodRequestDispatchStrategy } from './blood-request-dispatch.strategy';
import { ONegativeBloodRequestDispatch } from './o-negative-blood-request-dispatch.strategy';
import { OPositiveBloodRequestDispatch } from './o-positive-blood-request-dispatch.strategy';

export abstract class BaseBloodRequestDispatchStrategy extends WithApplication implements BloodRequestDispatchStrategy {
    protected readonly radius = [50_000, 'm'] as const;
    protected readonly maximum = 50 as const;

    static async #resolve(container: Container, constructor: { new(container: Container): BaseBloodRequestDispatchStrategy }): Promise<BaseBloodRequestDispatchStrategy> {

        try {
            const [strategy] = await container.inject(constructor);
            return strategy;
        } catch (error) {
            const strategy = Reflect.construct(constructor, [container]);

            container.register(constructor, strategy);
            return strategy;
        }

    }

    static async resolve(request: BloodRequest, container: Container): Promise<BaseBloodRequestDispatchStrategy> {
        switch (request.bloodGroup) {
            case BloodGroup.A:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? this.#resolve(container, ANegativeBloodRequestDispatch)
                    : this.#resolve(container, APositiveBloodRequestDispatch);
            case BloodGroup.B:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? this.#resolve(container, BNegativeBloodRequestDispatch)
                    : this.#resolve(container, BPositiveBloodRequestDispatch);
            case BloodGroup.O:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? this.#resolve(container, ONegativeBloodRequestDispatch)
                    : this.#resolve(container, OPositiveBloodRequestDispatch);
            case BloodGroup.AB:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? this.#resolve(container, ABNegativeBloodRequestDispatch)
                    : this.#resolve(container, ABPositiveBloodRequestDispatch);

            default:
                throw new Error(`Unsupported opperation yet [bloodGroup=${request.bloodGroup}] [rhesusFactor=${request.rhesusFactor}]`);
        }
    }

    constructor(container: Container) {
        super(container);
    }

    protected keys(requestId: string, dispatchId: string) {
        return {
            GROUP_A: this.key.donors.blood.group(BloodGroup.A),
            GROUP_B: this.key.donors.blood.group(BloodGroup.B),
            GROUP_O: this.key.donors.blood.group(BloodGroup.O),
            GROUP_AB: this.key.donors.blood.group(BloodGroup.AB),
            NEIGHBOURHOOD: this.key.of.neighbourhood(dispatchId),
            RHESUS_NEGATIVE: this.key.donors.blood.rhesus(RhesusFactor.NEGATIVE),
            RHESUS_POSITIVE: this.key.donors.blood.rhesus(RhesusFactor.POSITIVE),
            DISPATCH_A: this.key.donors.blood.dispatch(dispatchId, BloodGroup.A),
            DISPATCH_A_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.A, RhesusFactor.NEGATIVE),
            DISPATCH_A_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.A, RhesusFactor.POSITIVE),
            DISPATCH_B: this.key.donors.blood.dispatch(dispatchId, BloodGroup.B),
            DISPATCH_B_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.B, RhesusFactor.NEGATIVE),
            DISPATCH_B_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.B, RhesusFactor.POSITIVE),
            DISPATCH_O: this.key.donors.blood.dispatch(dispatchId, BloodGroup.O),
            DISPATCH_O_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.O, RhesusFactor.NEGATIVE),
            DISPATCH_O_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.O, RhesusFactor.POSITIVE),
            DISPATCH_AB: this.key.donors.blood.dispatch(dispatchId, BloodGroup.AB),
            DISPATCH_AB_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.AB, RhesusFactor.NEGATIVE),
            DISPATCH_AB_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.AB, RhesusFactor.POSITIVE),
            REQUEST_A: this.key.donors.blood.request(requestId, BloodGroup.A),
            REQUEST_A_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.A, RhesusFactor.NEGATIVE),
            REQUEST_A_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.A, RhesusFactor.POSITIVE),
            REQUEST_B: this.key.donors.blood.request(requestId, BloodGroup.B),
            REQUEST_B_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.B, RhesusFactor.NEGATIVE),
            REQUEST_B_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.B, RhesusFactor.POSITIVE),
            REQUEST_O: this.key.donors.blood.request(requestId, BloodGroup.O),
            REQUEST_O_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.O, RhesusFactor.NEGATIVE),
            REQUEST_O_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.O, RhesusFactor.POSITIVE),
            REQUEST_AB: this.key.donors.blood.request(requestId, BloodGroup.AB),
            REQUEST_AB_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.AB, RhesusFactor.NEGATIVE),
            REQUEST_AB_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.AB, RhesusFactor.POSITIVE),
        } as const;
    }

    protected async zcount(...keys: string[]): Promise<number> {
        return await Promise.all(keys.map(key => this.redis.zcard(key)))
            .then(cards => cards.reduce((count, card) => count + card, 0));
    }

    protected async collect<K extends string[]>(...keys: K): Promise<{ [key in keyof K]: K[key] extends string ? Record<string, number> | null : never }> {
        const raw = await Promise.all(keys.map(key => this.redis.zrange(key, 0, -1, 'WITHSCORES')));

        return raw.map(userIdDistancePairs => 0 === userIdDistancePairs.length
            ? null
            : userIdDistancePairs.reduce((stack, either, index, eithers) => {
                if (1 === index % 2) return stack;
                return {
                    ...stack,
                    [either]: +eithers[index + 1]!,
                };
            }, {} as Record<string, number>)) as any;
    }

    protected aggregate(requestId: string, dispatchId: string,
        ...rawDispatches: (readonly [BloodGroup, RhesusFactor | null, Record<string, number>])[]): BloodRequestDispatch {
        const dispatch = rawDispatches.reduce((dispatch, [group, rhesus, matches]) => {
            if (0 < Object.keys(matches).length) {
                if (!dispatch.outcome) dispatch.outcome ?? {};
                if (!dispatch.outcome![group]) dispatch.outcome![group] = {};
                if (!dispatch.outcome![group]![rhesus ?? '*']) dispatch.outcome![group]![rhesus ?? '*'] = matches;
            }
            return dispatch;
        }, { requestId, id: dispatchId, createdAt: Date.now() } as BloodRequestDispatch);

        return dispatch;
    }
    abstract dispatch(pros: [request: BloodRequest, lontitude: number, latitude: number], dispatchId?: string): Promise<BloodRequestDispatch>;
}
