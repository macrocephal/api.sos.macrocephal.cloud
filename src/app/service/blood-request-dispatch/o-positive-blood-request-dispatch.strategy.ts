import { v4 } from "uuid";
import { BloodGroup } from "../../model/blood-group";
import { BloodRequest } from "../../model/blood-request";
import { RhesusFactor } from "../../model/rhesus-factor";
import { withRedis } from "../../script/with-redis";
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class OPositiveBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    /**
     *
     * Dispatch blood request for O+ patient.
     *
     * In the neighbourhood:
     *
     * + Find O+ donors
     * + If O+ donors count > `this.maximum`, then cap O+ result to `this.maximum` entries
     * + Else if O+ donors count < `this.maximum`, find O- donors
     * + If O- donors count > `this.maximum`, then cap the O- to `this.maximum` entries
     * + If O+ donors count + O- donors count < this.maximum, then find O donors (i.e without rhesus factor consideration)
     * + If O donors count > `this.maximum`, then cap O result to `this.maximum` entries
     */
    async dispatch([request, longitude, latitude]: [BloodRequest, number, number], dispatchId?: string): Promise<BloodRequestDispatch> {
        dispatchId ??= v4();
        const COORDINATES = this.key.donors.blood.coordinates();
        const { GROUP_O, NEIGHBOURHOOD,
            RHESUS_POSITIVE, RHESUS_NEGATIVE,
            REQUEST_O, REQUEST_O_NEGATIVE, REQUEST_O_POSITIVE,
            DISPATCH_O, DISPATCH_O_NEGATIVE, DISPATCH_O_POSITIVE } = this.keys(request.id, dispatchId);

        await this.redis.send_command('GEORADIUS', COORDINATES, longitude, latitude, ...this.radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_O_POSITIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_POSITIVE);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_POSITIVE, DISPATCH_O_POSITIVE, REQUEST_O_POSITIVE);
        await this.redis.zrem(DISPATCH_O_POSITIVE, request.userId);
        await this.redis.zunionstore(REQUEST_O_POSITIVE, 2, REQUEST_O_POSITIVE, DISPATCH_O_POSITIVE);
        // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
        //       and add up the number of those who did to the maximum before capping
        await this.redis.zremrangebyrank(REQUEST_O_POSITIVE, this.maximum, -1);

        if (this.maximum > await this.zcount(REQUEST_O_POSITIVE)) {
            await this.redis.zinterstore(DISPATCH_O_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_NEGATIVE, DISPATCH_O_NEGATIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O_NEGATIVE, request.userId);
            await this.redis.zunionstore(REQUEST_O_NEGATIVE, 2, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_O_POSITIVE, REQUEST_O_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_O, 3, NEIGHBOURHOOD, GROUP_O);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O, DISPATCH_O, REQUEST_O_POSITIVE, REQUEST_O_NEGATIVE, REQUEST_O);
            await this.redis.zrem(DISPATCH_O, request.userId);
            await this.redis.zunionstore(REQUEST_O, 2, REQUEST_O, DISPATCH_O);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O, this.maximum, -1);
        }

        const dispatch = await this.collect(DISPATCH_O_POSITIVE, DISPATCH_O_NEGATIVE, DISPATCH_O)
            .then(([oPositives, oNegatives, o]) => this.aggregate(request.id, dispatchId!,
                ...oPositives ? [[BloodGroup.O, RhesusFactor.POSITIVE, oPositives]] as const : [],
                ...oNegatives ? [[BloodGroup.O, RhesusFactor.NEGATIVE, oNegatives]] as const : [],
                ...o ? [[BloodGroup.O, null, o]] as const : [],
            ));

        await this.redis.del(DISPATCH_O_POSITIVE, DISPATCH_O, NEIGHBOURHOOD);

        return dispatch;
    }
}
