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

}

