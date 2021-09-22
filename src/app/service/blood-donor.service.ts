import { Pipeline } from 'ioredis';
import { BloodGroup } from '../model/blood-group';
import { RhesusFactor } from '../model/rhesus-factor';
import { Container } from './../../container';
import { BloodDonor } from './../model/blood-donor';
import { WithApplication } from './../with-application';

export class BloodDonorService extends WithApplication {
    #donors!: FirebaseFirestore.CollectionReference<BloodDonor>;

    constructor(container: Container) {
        super(container);
        (async () => {
            this.#donors = this.firebase.firestore().collection('donors:blood')
                .withConverter<BloodDonor>({
                    fromFirestore: snapshot => snapshot.data() as BloodDonor,
                    toFirestore: model => model,
                });
        })();
    }

    async search(userId: string): Promise<BloodDonor> {
        const donor = (await this.#donors.doc(userId).get()).data();

        if (!donor) {
            const error = new Error(`Blood donor not found: ${userId}`);

            error.name = WithApplication.ERROR_NOT_FOUND;

            throw error;
        }

        return donor;
    }

    async create(userId: string, payload: { bloodGroup: BloodGroup, rhesusFactor?: RhesusFactor }): Promise<BloodDonor> {
        this.logger.debug('BloodDonorService.create <<< ', ...arguments);
        const donor: BloodDonor = { ...payload, createdAt: Date.now(), id: userId };
        let pipeline = this.redis.pipeline().sadd(this.key.donors.blood.group(donor.bloodGroup), userId);
        if (donor.rhesusFactor) pipeline = pipeline.sadd(this.key.donors.blood.rhesus(donor.rhesusFactor), userId);

        await Promise.all([
            this.#donors.doc(donor.id).set(donor, { merge: false }),
            pipeline.exec(),
        ]);

        this.logger.debug('BloodDonorService.create >>> ', donor);
        return donor;
    }

    async update(userId: string, payload: { bloodGroup: BloodGroup, rhesusFactor?: RhesusFactor }): Promise<BloodDonor> {
        this.logger.debug('BloodDonorService.update <<< ', ...arguments);
        const donor = await this.search(userId);

        let rem: Pipeline | undefined = undefined;
        let add: Pipeline | undefined = undefined;
        const bloodGroupKey = this.key.donors.blood.group(donor.bloodGroup);
        const rhesusFactorKey = this.key.donors.blood.rhesus(donor.rhesusFactor!);

        if (donor.bloodGroup !== payload.bloodGroup) {
            rem = this.redis.pipeline().srem(bloodGroupKey, userId);
            add = this.redis.pipeline().sadd(bloodGroupKey, userId);
        }

        if (donor.rhesusFactor !== payload.rhesusFactor) {
            rem = (rem ?? this.redis.pipeline()).srem(rhesusFactorKey, userId);
            add = (add ?? this.redis.pipeline()).sadd(rhesusFactorKey, userId);
        }

        const target = { ...donor, ...payload };

        await rem;
        await Promise.all([this.#donors.doc(target.id).set(target, { merge: true }), add]);

        this.logger.debug('BloodDonorService.update >>> ', target);
        return donor;
    }

    async delete(userId: string): Promise<void> {
        this.logger.debug('BloodDonorService.delete <<< ', ...arguments);
        const donor = await this.search(userId);

        await Promise.all([
            this.#donors.doc(userId).delete(),
            this.redis.pipeline()
                .zrem(this.key.donors.blood.coordinates(), userId)
                .srem(this.key.donors.blood.group(donor.bloodGroup), userId)
                .srem(this.key.donors.blood.rhesus(donor.rhesusFactor!), userId),
        ]);
        this.logger.debug('BloodDonorService.delete >>> ', userId);
    }

    async updatePosition(userId: string, payload: { longitude: number; latitude: number }): Promise<void> {
        this.logger.debug('BloodDonorService.updatePosition <<< ', ...arguments);
        await this.search(userId);

        await this.redis.geoadd(this.key.donors.blood.coordinates(), payload.longitude, payload.latitude, userId);
        this.logger.debug('BloodDonorService.updatePosition >>> ', userId);
    }
}
