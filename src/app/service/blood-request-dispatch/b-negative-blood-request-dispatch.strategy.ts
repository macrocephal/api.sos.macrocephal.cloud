import { BloodRequest } from "../../model/blood-request";
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { BaseBloodRequestDispatchStrategy } from "./base-blood-request-dispatch.strategy";

export class BNegativeBloodRequestDispatch extends BaseBloodRequestDispatchStrategy {
    dispatch([_request, _longitude, _latitude]: [BloodRequest, number, number], _dispatchId?: string): Promise<BloodRequestDispatch> {
        throw new Error("Method not implemented.");
    }
}
