import { v4 } from "uuid";
import { BloodGroup } from "../../model/blood-group";
import { BloodRequest } from "../../model/blood-request";
import { RhesusFactor } from "../../model/rhesus-factor";
import { withRedis } from "../../script/with-redis";
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class ABNegativeBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    /**
     *
     * Dispatch blood request for AB- patient.
     *
     * In the neighbourhood:
     *
     * + Find AB- and cap to `this.maximum` entries
     * + If AB- count < `this.maximum`, find O- and cap O- to `this.maximum` entries
     * + If AB- & O- count < `this.maximum`, find A and cap to `this.maximum` entries
     */
    async dispatch([request, longitude, latitude]: [BloodRequest, number, number], dispatchId?: string): Promise<BloodRequestDispatch> {
        dispatchId ??= v4();
        const COORDINATES = this.key.donors.blood.coordinates();
        const { GROUP_AB, GROUP_O, NEIGHBOURHOOD, RHESUS_NEGATIVE,
            REQUEST_AB, REQUEST_AB_NEGATIVE, REQUEST_O_NEGATIVE,
            DISPATCH_AB, DISPATCH_AB_NEGATIVE, DISPATCH_O_NEGATIVE } = this.keys(request.id, dispatchId);

        await this.redis.send_command('GEORADIUS', COORDINATES, longitude, latitude, ...this.radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_AB_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_AB, RHESUS_NEGATIVE);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_AB_NEGATIVE, DISPATCH_AB_NEGATIVE, REQUEST_AB_NEGATIVE);
        await this.redis.zrem(DISPATCH_AB_NEGATIVE, request.userId);
        await this.redis.zremrangebyrank(DISPATCH_AB_NEGATIVE, this.maximum, -1);
        await this.redis.zunionstore(REQUEST_AB_NEGATIVE, 2, REQUEST_AB_NEGATIVE, DISPATCH_AB_NEGATIVE);
        // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
        //       and add up the number of those who did to the maximum before capping
        await this.redis.zremrangebyrank(REQUEST_AB_NEGATIVE, this.maximum, -1);

        if (this.maximum > await this.zcount(REQUEST_AB_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_O_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_NEGATIVE, DISPATCH_O_NEGATIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O_NEGATIVE, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_O_NEGATIVE, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_O_NEGATIVE, 2, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE);
            await this.redis.zremrangebyrank(REQUEST_O_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_AB_NEGATIVE, REQUEST_O_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_AB, 3, NEIGHBOURHOOD, GROUP_O);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_AB, DISPATCH_AB, REQUEST_AB_NEGATIVE, REQUEST_O_NEGATIVE, REQUEST_AB);
            await this.redis.zremrangebyrank(DISPATCH_AB, this.maximum, -1);
            await this.redis.zrem(DISPATCH_AB, request.userId);
            await this.redis.zunionstore(REQUEST_AB, 2, REQUEST_AB, DISPATCH_AB);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_AB, this.maximum, -1);
        }

        const dispatch = await this.collect(DISPATCH_AB_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_AB)
            .then(([abNegatives, oNegatives, ab]) => this.aggregate(request.id, dispatchId!,
                ...abNegatives ? [[BloodGroup.AB, RhesusFactor.NEGATIVE, abNegatives]] as const : [],
                ...oNegatives ? [[BloodGroup.O, RhesusFactor.NEGATIVE, oNegatives]] as const : [],
                ...ab ? [[BloodGroup.AB, null, ab]] as const : [],
            ));

        await this.redis.del(DISPATCH_AB_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_AB, NEIGHBOURHOOD);

        return dispatch;
    }
}
