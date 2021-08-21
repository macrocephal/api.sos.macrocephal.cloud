import { Match } from './../model/match';
import { Service } from "./service";


export class MatchService extends Service<Match> {
    protected override unmarshall(hash: Record<string, string>): Match {
        return {
            ...super.unmarshall(hash),
        };
    }

    key(idOrKeyOrModel: (string | `${string}:${string}`) | Partial<Match>): `${string}:${string}` {
        return 'object' === typeof idOrKeyOrModel ? this.key(idOrKeyOrModel.id!)
            : this.isKey(idOrKeyOrModel) ? idOrKeyOrModel : `data:match:${idOrKeyOrModel}`;
    }

    id(key: string): string {
        return key.split('data:match:')[1]!;
    }
}
