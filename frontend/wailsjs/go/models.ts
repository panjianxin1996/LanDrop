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
	
	export class DeviceInfo {
	    ip: string;
	    hostname: string;
	    mac: string;
	    vendor: string;
	    model: string;
	    os: string;
	
	    static createFrom(source: any = {}) {
	        return new DeviceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.hostname = source["hostname"];
	        this.mac = source["mac"];
	        this.vendor = source["vendor"];
	        this.model = source["model"];
	        this.os = source["os"];
	    }
	}
	export class ScanNetworkData {
	    start_range: string;
	    end_range: string;
	    devices: DeviceInfo[];
	    total_count: number;
	    error?: any;
	
	    static createFrom(source: any = {}) {
	        return new ScanNetworkData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.start_range = source["start_range"];
	        this.end_range = source["end_range"];
	        this.devices = this.convertValues(source["devices"], DeviceInfo);
	        this.total_count = source["total_count"];
	        this.error = source["error"];
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

