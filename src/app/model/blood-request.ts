import { BloodGroup } from './blood-group';
import { Request } from './request';
import { RhesusFactor } from './rhesus-factor';

export interface BloodRequest extends Request {
    rhesusFactor: RhesusFactor;
    bloodGroup: BloodGroup;
}
