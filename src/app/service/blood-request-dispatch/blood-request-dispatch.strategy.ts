import { BloodRequest } from './../../model/blood-request';
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';

export interface BloodRequestDispatchStrategy {
    dispatch(pros: [request: BloodRequest, lontitude: number, latitude: number], dispatchId?: string): Promise<BloodRequestDispatch>;
}
