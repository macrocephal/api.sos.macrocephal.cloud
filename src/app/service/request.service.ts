import { Request } from './../model/request';
import { Service } from "./service";


export class RequestService extends Service<Request> {
    protected override unmarshall(hash: Record<string, string>): Request {
        return {
            ...super.unmarshall(hash),
        };
    }
    key(idOrKeyOrModel: (string | `${string}:${string}`) | Partial<Request>): `${string}:${string}` {
        return 'object' === typeof idOrKeyOrModel ? this.key(idOrKeyOrModel.id!)
            : this.isKey(idOrKeyOrModel) ? idOrKeyOrModel : `data:request:${idOrKeyOrModel}`;
    }
    id(key: string): string {
        return key.split('data:request:')[1]!;
    }
}
