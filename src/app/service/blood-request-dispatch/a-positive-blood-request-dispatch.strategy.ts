import { v4 } from "uuid";
import { BloodGroup } from "../../model/blood-group";
import { BloodRequest } from "../../model/blood-request";
import { BloodRequestDispatch } from "../../model/blood-request-dispatch";
import { RhesusFactor } from "../../model/rhesus-factor";
import { withRedis } from "../../script/with-redis";
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class APositiveBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    /**
     *
     * Dispatch blood request for A+ patient
     *
     * In the neighbourhood:
     *
     * + Find A+ and cap result to `this.maximum`
     * + If A+ count < `this.maximum`, find O+ and cap to `this.maximum` entries
     * + If A+ & O+ count < `this.maximum`, find A-  and cap to `this.maximum` entries
     * + If A+ & O+ & A- count < `this.maximum`, find O- and cap  to `this.maximum` entries
     * + If A+ & O+ & A- & O- count < `this.maximum`, find A and cap  to `this.maximum` entries
     * + If A+ & O+ & A- & O- & A count < `this.maximum`, find O and cap  to `this.maximum` entries
     */
    async dispatch([request, longitude, latitude]: [BloodRequest, number, number], dispatchId?: string): Promise<BloodRequestDispatch> {
        dispatchId ??= v4();
        const COORDINATES = this.key.donors.blood.coordinates();
        const {
            DISPATCH_A_NEGATIVE, DISPATCH_A_POSITIVE, DISPATCH_O_NEGATIVE, DISPATCH_O_POSITIVE,
            REQUEST_A_NEGATIVE, REQUEST_A_POSITIVE, REQUEST_O_POSITIVE, REQUEST_O_NEGATIVE,
            RHESUS_NEGATIVE, RHESUS_POSITIVE, NEIGHBOURHOOD,
            DISPATCH_A, DISPATCH_O, REQUEST_A, REQUEST_O,
            GROUP_A, GROUP_O,
        } = this.keys(request.id, dispatchId);

        await this.redis.send_command('GEORADIUS', COORDINATES, longitude, latitude, ...this.radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_A_POSITIVE, 3, NEIGHBOURHOOD, GROUP_A, RHESUS_POSITIVE);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_A_POSITIVE, DISPATCH_A_POSITIVE, REQUEST_A_POSITIVE);
        await this.redis.zrem(DISPATCH_A_POSITIVE, request.userId);
        await this.redis.zunionstore(REQUEST_A_POSITIVE, 2, REQUEST_A_POSITIVE, DISPATCH_A_POSITIVE);
        // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
        //       and add up the number of those who did to the maximum before capping
        await this.redis.zremrangebyrank(REQUEST_A_POSITIVE, this.maximum, -1);

        if (this.maximum > await this.zcount(REQUEST_A_POSITIVE)) {
            await this.redis.zinterstore(DISPATCH_O_POSITIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_POSITIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_POSITIVE, DISPATCH_O_POSITIVE, REQUEST_O_POSITIVE);
            await this.redis.zrem(DISPATCH_O_POSITIVE, request.userId);
            await this.redis.zunionstore(REQUEST_O_POSITIVE, 2, REQUEST_O_POSITIVE, DISPATCH_O_POSITIVE);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O_POSITIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_A_POSITIVE, REQUEST_O_POSITIVE)) {
            await this.redis.zinterstore(DISPATCH_A_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_A, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_A_NEGATIVE, DISPATCH_A_NEGATIVE, REQUEST_A_NEGATIVE);
            await this.redis.zrem(DISPATCH_A_NEGATIVE, request.userId);
            await this.redis.zunionstore(REQUEST_A_NEGATIVE, 2, REQUEST_A_NEGATIVE, DISPATCH_A_NEGATIVE);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_A_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_A_POSITIVE, REQUEST_O_POSITIVE, REQUEST_A_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_O_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_NEGATIVE, DISPATCH_O_NEGATIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O_NEGATIVE, request.userId);
            await this.redis.zunionstore(REQUEST_O_NEGATIVE, 2, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_A_POSITIVE, REQUEST_O_POSITIVE, REQUEST_A_NEGATIVE, DISPATCH_O_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_A, 3, NEIGHBOURHOOD, GROUP_A);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_A, DISPATCH_A, REQUEST_A, REQUEST_A_POSITIVE, REQUEST_A_NEGATIVE);
            await this.redis.zrem(DISPATCH_A, request.userId);
            await this.redis.zunionstore(REQUEST_A, 2, REQUEST_A, DISPATCH_A);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_A, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_A_POSITIVE, REQUEST_O_POSITIVE, REQUEST_A_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_A)) {
            await this.redis.zinterstore(DISPATCH_O, 3, NEIGHBOURHOOD, GROUP_O);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O, DISPATCH_O, REQUEST_O, REQUEST_O_POSITIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O, request.userId);
            await this.redis.zunionstore(REQUEST_O, 2, REQUEST_O, DISPATCH_O);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O, this.maximum, -1);
        }

        const dispatch = await this
            .collect(DISPATCH_A_POSITIVE, DISPATCH_O_POSITIVE, DISPATCH_A_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_A, DISPATCH_O)
            .then(([aPositives, oPositives, aNegatives, oNegatives, a, o]) => this.aggregate(request.id, dispatchId!,
                ...aPositives ? [[BloodGroup.A, RhesusFactor.POSITIVE, aPositives]] as const : [],
                ...oPositives ? [[BloodGroup.O, RhesusFactor.POSITIVE, oPositives]] as const : [],
                ...aNegatives ? [[BloodGroup.A, RhesusFactor.NEGATIVE, aNegatives]] as const : [],
                ...oNegatives ? [[BloodGroup.O, RhesusFactor.NEGATIVE, oNegatives]] as const : [],
                ...a ? [[BloodGroup.A, null, a]] as const : [],
                ...o ? [[BloodGroup.O, null, o]] as const : []));

        await this.redis.del(DISPATCH_A_POSITIVE, DISPATCH_O_POSITIVE, DISPATCH_A_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_A, DISPATCH_O, NEIGHBOURHOOD);

        return dispatch;
    }
}
