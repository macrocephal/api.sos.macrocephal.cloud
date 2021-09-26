import { v4 } from "uuid";
import { BloodGroup } from "../../model/blood-group";
import { BloodRequest } from "../../model/blood-request";
import { RhesusFactor } from "../../model/rhesus-factor";
import { withRedis } from "../../script/with-redis";
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class ABPositiveBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    /**
     *
     * Dispatch blood request for A+ patient
     *
     * In the neighbourhood:
     *
     * + Find AB+ and cap result to `this.maximum`
     * + If AB+ count < `this.maximum`, find O+ and cap to `this.maximum` entries
     * + If AB+ & O+ count < `this.maximum`, find AB-  and cap to `this.maximum` entries
     * + If AB+ & O+ & AB- count < `this.maximum`, find O- and cap  to `this.maximum` entries
     * + If AB+ & O+ & AB- & O- count < `this.maximum`, find AB and cap  to `this.maximum` entries
     * + If AB+ & O+ & AB- & O- & AB count < `this.maximum`, find O and cap  to `this.maximum` entries
     */
    async dispatch([request, longitude, latitude]: [BloodRequest, number, number], dispatchId?: string): Promise<BloodRequestDispatch> {
        dispatchId ??= v4();
        const COORDINATES = this.key.donors.blood.coordinates();
        const {
            DISPATCH_AB_NEGATIVE, DISPATCH_AB_POSITIVE, DISPATCH_O_NEGATIVE, DISPATCH_O_POSITIVE,
            REQUEST_AB_NEGATIVE, REQUEST_AB_POSITIVE, REQUEST_O_POSITIVE, REQUEST_O_NEGATIVE,
            RHESUS_NEGATIVE, RHESUS_POSITIVE, NEIGHBOURHOOD,
            DISPATCH_AB, DISPATCH_O, REQUEST_AB, REQUEST_O,
            GROUP_AB, GROUP_O,
        } = this.keys(request.id, dispatchId);

        await this.redis.send_command('GEORADIUS', COORDINATES, longitude, latitude, ...this.radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_AB_POSITIVE, 3, NEIGHBOURHOOD, GROUP_AB, RHESUS_POSITIVE);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_AB_POSITIVE, DISPATCH_AB_POSITIVE, REQUEST_AB_POSITIVE);
        await this.redis.zremrangebyrank(DISPATCH_AB_POSITIVE, this.maximum, -1);
        await this.redis.zrem(DISPATCH_AB_POSITIVE, request.userId);
        await this.redis.zunionstore(REQUEST_AB_POSITIVE, 2, REQUEST_AB_POSITIVE, DISPATCH_AB_POSITIVE);
        // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
        //       and add up the number of those who did to the maximum before capping
        await this.redis.zremrangebyrank(REQUEST_AB_POSITIVE, this.maximum, -1);

        if (this.maximum > await this.zcount(REQUEST_AB_POSITIVE)) {
            await this.redis.zinterstore(DISPATCH_O_POSITIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_POSITIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_POSITIVE, DISPATCH_O_POSITIVE, REQUEST_O_POSITIVE);
            await this.redis.zrem(DISPATCH_O_POSITIVE, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_O_POSITIVE, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_O_POSITIVE, 2, REQUEST_O_POSITIVE, DISPATCH_O_POSITIVE);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O_POSITIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_AB_POSITIVE, REQUEST_O_POSITIVE)) {
            await this.redis.zinterstore(DISPATCH_AB_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_AB, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_AB_NEGATIVE, DISPATCH_AB_NEGATIVE, REQUEST_AB_NEGATIVE);
            await this.redis.zrem(DISPATCH_AB_NEGATIVE, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_AB_NEGATIVE, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_AB_NEGATIVE, 2, REQUEST_AB_NEGATIVE, DISPATCH_AB_NEGATIVE);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_AB_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_AB_POSITIVE, REQUEST_O_POSITIVE, REQUEST_AB_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_O_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_NEGATIVE);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_NEGATIVE, DISPATCH_O_NEGATIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O_NEGATIVE, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_O_NEGATIVE, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_O_NEGATIVE, 2, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O_NEGATIVE, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_AB_POSITIVE, REQUEST_O_POSITIVE, REQUEST_AB_NEGATIVE, DISPATCH_O_NEGATIVE)) {
            await this.redis.zinterstore(DISPATCH_AB, 3, NEIGHBOURHOOD, GROUP_AB);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_AB, DISPATCH_AB, REQUEST_AB, REQUEST_AB_POSITIVE, REQUEST_AB_NEGATIVE);
            await this.redis.zrem(DISPATCH_AB, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_AB, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_AB, 2, REQUEST_AB, DISPATCH_AB);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_AB, this.maximum, -1);
        }

        if (this.maximum > await this.zcount(REQUEST_AB_POSITIVE, REQUEST_O_POSITIVE, REQUEST_AB_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_AB)) {
            await this.redis.zinterstore(DISPATCH_O, 3, NEIGHBOURHOOD, GROUP_O);
            await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O, DISPATCH_O, REQUEST_O, REQUEST_O_POSITIVE, REQUEST_O_NEGATIVE);
            await this.redis.zrem(DISPATCH_O, request.userId);
            await this.redis.zremrangebyrank(DISPATCH_O, this.maximum, -1);
            await this.redis.zunionstore(REQUEST_O, 2, REQUEST_O, DISPATCH_O);
            // TODO: un-notify matches ranking this.maximum+ IFF they haven't responded to the dispatch
            //       and add up the number of those who did to the maximum before capping
            await this.redis.zremrangebyrank(REQUEST_O, this.maximum, -1);
        }

        const dispatch = await this
            .collect(DISPATCH_AB_POSITIVE, DISPATCH_O_POSITIVE, DISPATCH_AB_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_AB, DISPATCH_O)
            .then(([abPositives, oPositives, abNegatives, oNegatives, ab, o]) => this.aggregate(request.id, dispatchId!,
                ...abPositives ? [[BloodGroup.AB, RhesusFactor.POSITIVE, abPositives]] as const : [],
                ...oPositives ? [[BloodGroup.O, RhesusFactor.POSITIVE, oPositives]] as const : [],
                ...abNegatives ? [[BloodGroup.AB, RhesusFactor.NEGATIVE, abNegatives]] as const : [],
                ...oNegatives ? [[BloodGroup.O, RhesusFactor.NEGATIVE, oNegatives]] as const : [],
                ...ab ? [[BloodGroup.A, null, ab]] as const : [],
                ...o ? [[BloodGroup.O, null, o]] as const : []));

        await this.redis.del(DISPATCH_AB_POSITIVE, DISPATCH_O_POSITIVE, DISPATCH_AB_NEGATIVE, DISPATCH_O_NEGATIVE, DISPATCH_AB, DISPATCH_O, NEIGHBOURHOOD);

        return dispatch;
    }
}
