import { Model } from './model';
import { BloodGroup } from "./blood-group";
import { RhesusFactor } from "./rhesus-factor";

export interface BloodDonor extends Model {
    rhesusFactor: RhesusFactor;
    bloodGroup: BloodGroup;
}
