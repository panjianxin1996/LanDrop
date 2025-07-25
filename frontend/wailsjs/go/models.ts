export namespace server {
	
	export class Config {
	    appName: string;
	    port: number;
	    sharedDir: string;
	    version: string;
	    tokenExpiryTime: number;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.port = source["port"];
	        this.sharedDir = source["sharedDir"];
	        this.version = source["version"];
	        this.tokenExpiryTime = source["tokenExpiryTime"];
	    }
	}
	export class UserToken {
	    userId: number;
	    userName: string;
	    role: string;
	    iss?: string;
	    sub?: string;
	    aud?: string[];
	    // Go type: jwt
	    exp?: any;
	    // Go type: jwt
	    nbf?: any;
	    // Go type: jwt
	    iat?: any;
	    jti?: string;
	
	    static createFrom(source: any = {}) {
	        return new UserToken(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userId = source["userId"];
	        this.userName = source["userName"];
	        this.role = source["role"];
	        this.iss = source["iss"];
	        this.sub = source["sub"];
	        this.aud = source["aud"];
	        this.exp = this.convertValues(source["exp"], null);
	        this.nbf = this.convertValues(source["nbf"], null);
	        this.iat = this.convertValues(source["iat"], null);
	        this.jti = source["jti"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace tools {
	
	export class ScanNetworkData {
	    startRange: number[];
	    endRange: number[];
	    devices: any[];
	    totalCount: number;
	    error: any;
	
	    static createFrom(source: any = {}) {
	        return new ScanNetworkData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startRange = source["startRange"];
	        this.endRange = source["endRange"];
	        this.devices = source["devices"];
	        this.totalCount = source["totalCount"];
	        this.error = source["error"];
	    }
	}

}

