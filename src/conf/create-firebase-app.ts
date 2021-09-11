import { FIREBASE_SERVICE_ACCOUNT } from './create-env';
import firebaseAdmin from 'firebase-admin';
import { Container } from '../container';

export const FIREBASE_APP_TOKEN: Token<firebaseAdmin.app.App> = Symbol('Firebase app');

export const createFirebaseApp: Container.Visitor = container =>
    container.register(FIREBASE_APP_TOKEN, async () => {
        const [firebaseServiceAccount] = await container.inject(FIREBASE_SERVICE_ACCOUNT);

        return firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(firebaseServiceAccount),
        });
    });
