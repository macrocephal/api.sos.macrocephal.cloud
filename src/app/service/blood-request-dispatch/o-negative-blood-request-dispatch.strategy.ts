import { v4 } from "uuid";
import { BloodGroup } from "../../model/blood-group";
import { BloodRequest } from "../../model/blood-request";
import { RhesusFactor } from "../../model/rhesus-factor";
import { withRedis } from "../../script/with-redis";
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class ONegativeBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    /**
     *
     * Dispatch blood request for O- patient.
     *
     * In the neighbourhood:
     *
     * + Find O- donors
     * + If O- donors count > `this.maximum`, then cap the result to `this.maximum` entries
     *
     */
    async dispatch([request, longitude, latitude]: [BloodRequest, number, number], dispatchId?: string): Promise<BloodRequestDispatch> {
        dispatchId ??= v4();
        const COORDINATES = this.key.donors.blood.coordinates();
        const { GROUP_O, RHESUS_NEGATIVE, NEIGHBOURHOOD, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE } = this.keys(request.id, dispatchId);

        await this.redis.send_command('GEORADIUS', COORDINATES, longitude, latitude, ...this.radius, 'ASC', 'STOREDIST', NEIGHBOURHOOD);
        await this.redis.zinterstore(DISPATCH_O_NEGATIVE, 3, NEIGHBOURHOOD, GROUP_O, RHESUS_NEGATIVE);
        await withRedis(this.redis).ZDIFFSTORE(DISPATCH_O_NEGATIVE, DISPATCH_O_NEGATIVE, REQUEST_O_NEGATIVE);
        await this.redis.zrem(DISPATCH_O_NEGATIVE, request.userId);
        await this.redis.zunionstore(REQUEST_O_NEGATIVE, 2, REQUEST_O_NEGATIVE, DISPATCH_O_NEGATIVE);
        await this.redis.zremrangebyrank(REQUEST_O_NEGATIVE, this.maximum, -1);

        const dispatch = await this.collect(DISPATCH_O_NEGATIVE)
            .then(([oNegatives]) => this.aggregate(request.id, dispatchId!,
                ...oNegatives ? [[BloodGroup.O, RhesusFactor.NEGATIVE, oNegatives]] as const : [],
            ));

        await this.redis.del(DISPATCH_O_NEGATIVE, NEIGHBOURHOOD);

        return dispatch;
    }
}
