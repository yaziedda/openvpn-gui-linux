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

}

