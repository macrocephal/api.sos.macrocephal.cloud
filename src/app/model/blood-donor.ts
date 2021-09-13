import { BloodGroup } from "./blood-group";
import { RhesusFactor } from "./rhesus-factor";

export interface BloodDonor {
    rhesusFactor: RhesusFactor;
    bloodGroup: BloodGroup;
    userId: string;

    recycledAt?: number;
    createdAt?: number;
    updatedAt?: number;
}
