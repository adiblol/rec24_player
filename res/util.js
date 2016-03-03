var dt2datestr = function(ts) {
	return ts.getFullYear()+'-'+zeropad(ts.getMonth()+1)+'-'+zeropad(ts.getDate());
}
var dt2timestr = function(ts) {
	return zeropad(ts.getHours())+':'+zeropad(ts.getMinutes())+':'+zeropad(ts.getSeconds());
}

var lintodb = function(v) {
	return 20*Math.log(v)/Math.LN10;
}
var dbtolin = function(v) {
	return Math.exp(v*Math.LN10/20);
}

var zeropad = function(val) {
	if (val>=10) return val;
	return '0'+val;
};


var ServerWallclock = function(created) {
	this.offset = 0;
	var c = this;
	this.ready = false;
	$.get('./get.php', { mode: 'get_time' }, function(r) {
		c.offset = r.ts - Date.now()/1000;
		if (Math.abs(c.offset)>5) log('More than 5 seconds of clock difference! Compensating, but please, sync your clock.');
		c.ready = true;
		if (typeof created == 'function') created();
	}, 'json');
};
ServerWallclock.prototype.get = function() {
	return new Date(Date.now()+this.offset*1000);
};
