import { v4 } from "uuid";
import { BloodGroup } from "../../model/blood-group";
import { BloodRequest } from "../../model/blood-request";
import { RhesusFactor } from "../../model/rhesus-factor";
import { withRedis } from "../../script/with-redis";
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class ANegativeBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    /**
     *
     * Dispatch blood request for A- patient.
     *
     * In the neighbourhood:
     *
     * + Find A- donors
     * + Cap A- result to `this.maximum` entries
     * + If A- result count < `this.maximum`, find O- donors
     * + Cap O- result to `this.maximum` entries
     * + If A- result count + O- result count < `this.maximum`, find A donors
     * + Cap A result to `this.maximum` entries
     */
    async dispatch([request, longitude, latitude]: [BloodRequest, number, number], dispatchId?: string): Promise<BloodRequestDispatch> {
        dispatchId ??= v4();
        const COORDINATES = this.key.donors.blood.coordinates();
        const { GROUP_A, GROUP_O, NEIGHBOURHOOD, RHESUS_NEGATIVE,
            REQUEST_A, REQUEST_A_NEGATIVE, REQUEST_O_NEGATIVE,
            DISPATCH_A, DISPATCH_A_NEGATIVE, DISPATCH_O_NEGATIVE } = this.keys(request.id, dispatchId);

        await this.redis.send_command('GEORADIUS', COORDINATES, longitude, latitude, ...this.radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_A_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_A, RHESUS_NEGATIVE);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_A_NEGATIVE, DISPATCH_A_NEGATIVE, REQUEST_A_NEGATIVE);
        await this.redis.zrem(DISPATCH_A_NEGATIVE, request.userId);
        await this.redis.zremrangebyrank(DISPATCH_A_NEGATIVE, this.maximum, -1);
        await this.redis.zunionstore(REQUEST_A_NEGATIVE, 2, REQUEST_A_NEGATIVE, DISPATCH_A_NEGATIVE);
        // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
        //       and add up the number of those who did to the maximum before capping
        await this.redis.zremrangebyrank(REQUEST_A_NEGATIVE, this.maximum, -1);

        if (this.maximum > await this.zcount(REQUEST_A_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_O_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_NEGATIVE, DISPATCH_O_NEGATIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O_NEGATIVE, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_O_NEGATIVE, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_O_NEGATIVE, 2, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE);
            await this.redis.zremrangebyrank(REQUEST_O_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_A_NEGATIVE, REQUEST_O_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_A, 3, NEIGHBOURHOOD, GROUP_O);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_A, DISPATCH_A, REQUEST_A_NEGATIVE, REQUEST_O_NEGATIVE, REQUEST_A);
            await this.redis.zremrangebyrank(DISPATCH_A, this.maximum, -1);
            await this.redis.zrem(DISPATCH_A, request.userId);
            await this.redis.zunionstore(REQUEST_A, 2, REQUEST_A, DISPATCH_A);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_A, this.maximum, -1);
        }

        const dispatch = await this.collect(DISPATCH_A_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_A)
            .then(([aNegatives, oNegatives, a]) => this.aggregate(request.id, dispatchId!,
                ...aNegatives ? [[BloodGroup.A, RhesusFactor.NEGATIVE, aNegatives]] as const : [],
                ...oNegatives ? [[BloodGroup.O, RhesusFactor.NEGATIVE, oNegatives]] as const : [],
                ...a ? [[BloodGroup.A, null, a]] as const : [],
            ));

        await this.redis.del(DISPATCH_A_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_A, NEIGHBOURHOOD);

        return dispatch;
    }
}
