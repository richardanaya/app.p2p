function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
};

function guid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

var Key = function(v) {
    this.val = Math.pow(2,32)*Math.random();
    if(typeof(v) == "number"){
        this.val = v;
    }
    else {
        this.val = v.val;
    }
    this.hash = this.val.toString(16);
    while(this.hash.length != 8){
        this.hash = "0"+this.hash;
    }
}

Key.prototype.distance = function(k) {
    return Math.abs(this.val-k.val);
}

Key.prototype.match = function(k) {
    var i;
    for(i = 0 ; i < k.hash.length && this.hash.length; i++){
        if(this.hash[i] != k.hash[i]){
            break;
        }
    }
    return i;
}

Key.prototype.closest = function(keys) {
    var closest = null;
    var dist = 9007199254740992;
    for(var i=0; i < keys.length; i++){
        var d = keys[i].distance(this);
        if(d<dist){
            closest = keys[i];
            dist = d;
        }
    }
    return closest;
}

Key.prototype.closestKeys = function(keys,n) {
    var _this = this;
    var comp = function(a,b){
        var da = _this.distance(a);
        var db = _this.distance(b);
        if(da<db){ return -1 }
        if(da>db){ return 1 }
        return 0;
    }
    keys = keys.sort(comp);
    var closest = [];
    for(var i = 0 ; i < keys.length && i < n; i++){
        closest.push(keys[i]);
    }
    return closest;
}

Key.prototype.isInRange = function(j,k) {
    return (this.val >= j.val) && (this.val <= k.val);
}

Key.prototype.toString = function() {
    return "[Key "+this.hash+"]";
}

var Emitter = function () {
    this.channels = {};
};

Emitter.prototype.fire = function (channel) {
    var subscribers = this.channels[channel];
    if (!subscribers) {
        return;
    }
    var args = [];
    for (var i = 1; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    for (i = 0; i < subscribers.length; i++) {
        subscribers[i].apply(null, args);
    }
};

Emitter.prototype.pipe = function (sourceEmitter, channel) {
    var _this = this;
    sourceEmitter.on(channel, function () {
        var args = [channel];
        for(var i=0;i<arguments.length;i++){
            args.push(arguments[i]);
        }

        _this.fire.apply(_this, args);
    })
};

Emitter.prototype.on = function (channel, func) {
    var subscribers = this.channels[channel];
    if (!subscribers) {
        subscribers = [];
        this.channels[channel] = subscribers;
    }

    subscribers.push(func);
};

var App = function(key){
    Emitter.call(this);
    var _this = this;
    this.guid = guid();
    this.key = key;
    this.mux = new Mux({maxSize:1000});

    this.fire("message");
    this.fire("foward");
    this.fire("leaf");
}

App.prototype = Object.create(Emitter.prototype);

App.prototype.send = function(obj,key){
    this.mux.send(JSON.stringify(obj));
}

App.prototype.join = function(serverGuid){
    var _this = this;
    var peer = new Peer({key: this.key});
    var conn = peer.connect(serverGuid);
    conn.on('open', function() {
        _this.mux.on("messageReceived",function(message){
            _this.fire('message',JSON.parse(message));
        });
        _this.mux.on('requestSendData',function(data){
            conn.send(data);
        });
        conn.on('data', function(data) {
            _this.mux.processData(data);
        });
        _this.fire("connected");
    });
    conn.on('close', function() {
        _this.fire("disconnected");
    });
    conn.on('error', function(error) {
        _this.fire("error",error);
    });
};

App.prototype.host = function(){
    var _this = this;
    var peer = new Peer(this.guid, {key: this.key});
    peer.on('connection', function(conn){
        _this.mux.on("messageReceived",function(message){
            _this.fire('message',JSON.parse(message));
        });
        _this.mux.on('requestSendData',function(data){
            conn.send(data);
        });
        conn.on('data', function(data) {
            _this.mux.processData(data);
        });
        conn.on('close', function() {
            _this.fire("disconnected");
        });
        conn.on('error', function(error) {
            _this.fire("error",error);
        });
        _this.fire("connected");
    });
};
