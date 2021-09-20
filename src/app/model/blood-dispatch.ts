import { BloodGroup } from './blood-group';
import { Model } from './model';
import { RhesusFactor } from './rhesus-factor';

export type UserId = string;
export type Distance = number;

export interface BloodDispatch extends Model {
    requestId: string;
    outcome: {
        [key in BloodGroup]?: {
            [key in RhesusFactor | '*']?: Record<UserId, Distance>;
        }
    } | null;
}
