export namespace main {
	
	export class Profile {
	    name: string;
	    username: string;
	    password: string;
	    config_file: string;
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.config_file = source["config_file"];
	    }
	}

	export class SessionStats {
	    status: string;
	    profile_name: string;
	    config_file: string;
	    vpn_ip: string;
	    server_ip: string;
	    device: string;
	    duration_secs: number;
	    bytes_in: number;
	    bytes_out: number;

	    static createFrom(source: any = {}) {
	        return new SessionStats(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.profile_name = source["profile_name"];
	        this.config_file = source["config_file"];
	        this.vpn_ip = source["vpn_ip"];
	        this.server_ip = source["server_ip"];
	        this.device = source["device"];
	        this.duration_secs = source["duration_secs"];
	        this.bytes_in = source["bytes_in"];
	        this.bytes_out = source["bytes_out"];
	    }
	}

}

