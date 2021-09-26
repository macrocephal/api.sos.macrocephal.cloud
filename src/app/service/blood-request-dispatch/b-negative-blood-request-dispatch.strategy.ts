import { v4 } from "uuid";
import { BloodGroup } from "../../model/blood-group";
import { BloodRequest } from "../../model/blood-request";
import { RhesusFactor } from "../../model/rhesus-factor";
import { withRedis } from "../../script/with-redis";
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class BNegativeBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    /**
     *
     * Dispatch blood request for B- patient.
     *
     * In the neighbourhood:
     *
     * + Find B- and cap to `this.maximum` entries
     * + If B- count < `this.maximum`, find O- and cap O- to `this.maximum` entries
     * + If B- & O- count < `this.maximum`, find A and cap to `this.maximum` entries
     */
    async dispatch([request, longitude, latitude]: [BloodRequest, number, number], dispatchId?: string): Promise<BloodRequestDispatch> {
        dispatchId ??= v4();
        const COORDINATES = this.key.donors.blood.coordinates();
        const { GROUP_B, GROUP_O, NEIGHBOURHOOD, RHESUS_NEGATIVE,
            REQUEST_B, REQUEST_B_NEGATIVE, REQUEST_O_NEGATIVE,
            DISPATCH_B, DISPATCH_B_NEGATIVE, DISPATCH_O_NEGATIVE } = this.keys(request.id, dispatchId);

        await this.redis.send_command('GEORADIUS', COORDINATES, longitude, latitude, ...this.radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_B_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_B, RHESUS_NEGATIVE);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_B_NEGATIVE, DISPATCH_B_NEGATIVE, REQUEST_B_NEGATIVE);
        await this.redis.zrem(DISPATCH_B_NEGATIVE, request.userId);
        await this.redis.zremrangebyrank(DISPATCH_B_NEGATIVE, this.maximum, -1);
        await this.redis.zunionstore(REQUEST_B_NEGATIVE, 2, REQUEST_B_NEGATIVE, DISPATCH_B_NEGATIVE);
        // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
        //       and add up the number of those who did to the maximum before capping
        await this.redis.zremrangebyrank(REQUEST_B_NEGATIVE, this.maximum, -1);

        if (this.maximum > await this.zcount(REQUEST_B_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_O_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_NEGATIVE, DISPATCH_O_NEGATIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O_NEGATIVE, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_O_NEGATIVE, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_O_NEGATIVE, 2, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE);
            await this.redis.zremrangebyrank(REQUEST_O_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_B_NEGATIVE, REQUEST_O_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_B, 3, NEIGHBOURHOOD, GROUP_O);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_B, DISPATCH_B, REQUEST_B_NEGATIVE, REQUEST_O_NEGATIVE, REQUEST_B);
            await this.redis.zremrangebyrank(DISPATCH_B, this.maximum, -1);
            await this.redis.zrem(DISPATCH_B, request.userId);
            await this.redis.zunionstore(REQUEST_B, 2, REQUEST_B, DISPATCH_B);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_B, this.maximum, -1);
        }

        const dispatch = await this.collect(DISPATCH_B_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_B)
            .then(([bNegatives, oNegatives, b]) => this.aggregate(request.id, dispatchId!,
                ...bNegatives ? [[BloodGroup.B, RhesusFactor.NEGATIVE, bNegatives]] as const : [],
                ...oNegatives ? [[BloodGroup.O, RhesusFactor.NEGATIVE, oNegatives]] as const : [],
                ...b ? [[BloodGroup.A, null, b]] as const : [],
            ));

        await this.redis.del(DISPATCH_B_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_B, NEIGHBOURHOOD);

        return dispatch;
    }
}
