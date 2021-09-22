import { app, auth, firestore } from 'firebase-admin';
import { Redis } from 'ioredis';
import { FIREBASE_APP_TOKEN } from './../conf/create-firebase-app';
import { REDIS_TOKEN } from './../conf/create-redis';
import { Container } from './../container';

export class WithApplication extends Container.WithContainer {
    protected get redis(): Promise<Redis> {
        return this.container.inject(REDIS_TOKEN).then(([redis]) => redis);
    }

    protected get firebase(): Promise<app.App> {
        return this.container.inject(FIREBASE_APP_TOKEN).then(([app]) => app);
    }

    protected get auth(): Promise<auth.Auth> {
        return this.container.inject(FIREBASE_APP_TOKEN).then(([app]) => auth(app));
    }

    protected get firestore(): Promise<FirebaseFirestore.Firestore> {
        return this.container.inject(FIREBASE_APP_TOKEN).then(([app]) => firestore(app));
    }
}
