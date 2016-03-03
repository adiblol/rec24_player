function PartPlayer(descriptor, webplayer) {
	this.webplayer = webplayer;
	this.descriptor = descriptor;
	this.ts_start = null;
	this.ts_end = null;
	if (descriptor.rec_start!=0) this.ts_start = new Date(descriptor.rec_start*1000);
	if (descriptor.rec_end!=0) this.ts_end = new Date(descriptor.rec_end*1000);
	this.live = (descriptor.live == 1);
	if (Number.isFinite(this.descriptor.offset)) {
		this.offset = this.descriptor.offset;
	} else {
		this.offset = 0;
	}
	this.compensation = 1.0;
	this.active = false;
	this.buffering = false;
	this.player = new Audio();
	this.player.muted = true;
	this.player.preload = 'auto';
	this.set_src = function() {
		if (this.player==null) {
			console.log("set_src called for player == null!!!!!!");

		}
		if (this.live) {
			this.player.src = this.descriptor.filename+'?forcenocache='+(Date.now()/1000);
		} else if (!this.buffering) {
			this.player.src = this.descriptor.filename;
		}
		this.player.load();
		this.buffering = true;
	};
	this.set_src();
	this.last_used = null;
	this.pp_next = null;
	var pp = this;
	var wp = this.webplayer;
	this.player.addEventListener('durationchange', function() { pp.update_compensation(); });
	var updatewp = function() {
		if (pp.active) {
			wp.update_state();
		}
	};
	this.play = function() {
		this.player.play();
		if (this.webplayer.force_pause==true) {
			//this.player.pause();
			//this.webplayer.force_pause = null;
		}
		this.webplayer.force_pause = null;
	};
	this.player.addEventListener('timeupdate', updatewp);
	this.player.addEventListener('abort', updatewp);
	this.player.addEventListener('pause', updatewp);
	this.player.addEventListener('seeking', updatewp);
	this.player.addEventListener('canplay', function() {
		if (pp.active && (pp.player.readyState>0)) { // some buggy browsers send canplay event on readyState==0, lol.
			pp.player.muted = false;
			//pp.play();
			if (pp.offset!=null) {
				pp.player.currentTime = pp.offset*pp.compensation;
				//pp.offset = null;
			}
			pp.play();
			 /*else {
				pp.player.currentTime = 0;
			}*/
		}
		pp.player.volume = dbtolin(wp.volume_db);
	});
	this.player.addEventListener('ended', function() {
		console.log('file ended');
		pp.deactivate();
		//pp.destroy(); //maybe?
		if (pp.next_pp!=null) {
			console.log('switching to next file');
			pp.next_pp.activate();
			//pp.player.play();
			wp.playback_start();
		} else {
			console.log('no cached next file :(');
			if (pp.descriptor.nextid!=0) {
				wp.add_player_by_id(pp.descriptor.nextid, function(p) { wp.player_got(p); });
			}
		}
	});
	this.player.addEventListener('seeked', function() {
		if (pp.active) {
			console.log('seeked');
			pp.offset = null;
			wp.player_ready();
			pp.play();
		}
	});
	this.is_ts_inside = function(ts) {
		return ( (ts>=this.ts_start) && ( (this.ts_end==null) || (ts<=this.ts_end) ) );
	};
	this.seek_to_ts = function(ts) {
		if (!(this.is_ts_inside(ts))) return false;
		var newoffset = (ts.getTime()-this.ts_start.getTime())/1000.0;
		if (this.player.readyState>0) {
			this.player.currentTime = newoffset*this.compensation;
		} else {
			this.offset = newoffset;
		}
		//this.player.currentTime = (ts.getTime()-this.ts_start.getTime())*this.compensation/1000.0;
		return true;
	};
	this.get_current_ts = function() {
		if (this.offset==null) {
			return new Date(this.ts_start.getTime()+(this.player.currentTime*1000.0/this.compensation));
		} else {
			return new Date(this.ts_start.getTime()+(this.offset*1000.0));
		}
	};
	this.toggle = function() {
		if (this.player.paused) {
			this.player.play();
		} else {
			this.player.pause();
		}
		updatewp();
	};
	this.update_compensation = function() {
		var com = 1.0;
		if (Number.isFinite(this.player.duration) && (this.player.duration!=0) && (this.ts_start!=null) && (this.ts_end!=null)) {
			com = this.player.duration*1000 / (this.ts_end.getTime()-this.ts_start.getTime());
		}
		if ((com>1.2) || (com<0.8)) {
			console.log("Strange compensation: "+com);
			com = 1.0;
		}
		this.compensation = com;
	};
	this.activate = function() {
		this.set_src();
		if (this.active) return;
		if ((this.next_pp==null) && (this.descriptor.nextid>0)) this.next_pp = this.webplayer.get_player_by_recid(this.descriptor.nextid);
		this.active = true;
		//this.player.muted = true;
		this.player.muted = false;
		//if (!this.webplayer.paused) this.player.play();
		//this.webplayer.current_player = this;
		this.webplayer.set_current_player(this);
		this.play();
		/*if (this.offset==null) {
			this.currentTime = 0;
		} else {
			// set offset only on first activation
			this.currentTime = this.offset;
			this.offset = null;
		}*/
	};
	this.deactivate = function() {
		this.offset = 0;
		if (this.player!=null) {
			this.player.muted = true;
			this.player.pause();
		}
		this.active = false;
		if (this.webplayer.current_player==this) this.webplayer.current_player = null;
	};
	this.destroy = function() {
		this.deactivate();
		this.buffering = false;

		if (this.player!=null) {
			this.player.pause();
			//
			this.player.src = './res/silence.ogg';
			this.player.load();
			this.player.removeAttribute('src');
		}
		//this.player = null;
	};
	this.is_near_end = function() {
		return ( (this.player.currentTime>0) && (this.player.currentTime>(this.player.duration-60)) );
	};
}

function WebPlayer(maindiv, onready) {
	wp = this;
	this.maindiv = maindiv;
	this.last_update = null;
	this.wallclock = new ServerWallclock(onready);
	this.current_player = null;
	this.players = [];
	this.volume_db = 0;
	this.requests = [null, null];
	this.change_ts_timeout = null;
	this.force_pause = null;
	this.update_address = function() {
		if (this.current_player==null) {
			history.replaceState(null, null, '#');
			return;
		}
		if (this.get_current_ts()==null) return;
		history.replaceState(null, null, '#'+$('#origin_select').val()+'#'+this.get_current_ts().toISOString());
	};
	this.playpause = function() {
		this.last_update = null;
		//if (this.current_player!=null) {
		if ((this.desired_ts==null) && (this.current_player!=null) && (this.current_player.active)) {
			this.current_player.toggle();
		} else if (this.get_stopped()) {
			console.log('starting playback');
			this.playback_start();
		} else {
			if (this.force_pause==null) {
				console.log('forcing pause');
				this.force_pause = true;
			} else {
				console.log('toggling force_pause');
				this.force_pause = !this.force_pause;
			}
		}
		this.update_address();
	};
	this.stop = function() {
		//if (this.current_player!=null) this.current_player.deactivate();
		this.last_update = null;
		this.update_address();
		this.requests.forEach(function(req, index, arr) {
			if (req==null) return;
			req.abort();
			arr[index] = null;
		});
		this.flush_players();
		this.current_player = null;
		this.last_update = null;
		this.force_pause = null;
		this.update_state();
	};
	this.change_vol = function(delta) {
		this.volume_db += delta;
		if (this.volume_db>0) this.volume_db = 0;
		if (this.volume_db<-99) this.volume_db = -99;
		if (this.current_player!=null) this.current_player.player.volume = dbtolin(this.volume_db);
		this.last_update = null;
		this.update_state();
	};
	this.playback_start = function() {
		/*if ( (this.ts_desired==null) || (this.ts_desired.getTime()>=Date.now()) ) {
			ts_desired = new Date(Date.now()-60000);
		}*/
		this.change_ts(0);
	};
	this.playback_restart = function() {
		this.flush_players();
		//this.playback_start();
		this.playpause();
	}
	this.set_current_player = function(p) {
		if ((this.current_player!=null) && (this.current_player!=p)) this.current_player.deactivate();
		this.current_player = p;
		this.last_update = null;
	};
	this.flush_players = function() {
		console.log('calling get_users_ts from flush_players');
		var ts = this.get_user_ts();
		this.players.forEach(function(player, index, arr) {
			//player.deactivate();
			player.destroy();
			//arr[index] = null;
		});
		this.players = [];
		if (this.current_player!=null) this.current_player.destroy();
		this.current_player = null;
		this.last_update = null;
		this.ts_desired = ts;
		this.update_state();
	};
	this.collect_garbage = function() {
		if (this.ts_desired!=null) return;
		if (this.current_player==null) {
			console.log('current_player is null in collect_garbage()');
			this.flush_players();
		}
		for (var i = this.players.length-1; i>=0; i--) {
			if (this.players[i]==null) continue;
			if ((this.players[i]!=this.current_player) && (this.players[i].descriptor.recid!=this.current_player.descriptor.nextid)) {
				if (this.players[i]!=null) this.players[i].destroy();
				this.players.splice(i, 1);
			}
		}
		if (this.players.length==0) console.log('players[] completely emptied after collect_garbage!');
	};
	this.get_user_ts = function() {
		var default_ts = new Date(this.wallclock.get().getTime()-60000);
		if (this.ts_desired!=null) {
			if (this.ts_desired>this.wallclock.get()) {
				console.log('returning default_ts because ts_desired is in the future!');
				return default_ts;
			}
			return this.ts_desired;
		} else if (this.get_current_ts()!=null) {
			return this.get_current_ts();
		} else {
			console.log('returning default_ts because both ts_desired and get_current_ts() is null');
			return default_ts;
		}
	};
	this.change_ts = function(delta, immediately) {
		immediately = ( (typeof immediately !== 'undefined') ? immediately : false );
		/*var cts = null;
		if ( (this.ts_desired>(new Date())) || ((this.ts_desired==null) && (this.get_current_ts()==null)) ) {
			cts = Date.now()-60000;
		} else {
			if (this.ts_desired!=null) {
				cts = this.ts_desired.getTime();
			} else if (this.get_current_ts()!=null) {
				cts = this.get_current_ts();
			} else {
				console.log('fatal bug lol');
				return;
			}
		}*/
		this.last_update = null;
		//console.log('calling get_user_ts from change_ts');
		var cts = this.get_user_ts().getTime();
		this.ts_desired = new Date(cts + delta*1000);
		if (this.ts_desired==null) {
			console.log("BUG! ts_desired==NULL in change_ts");
			return;
		}
		if (!this.try_seek_current_player()) {
			//this.set_seeking(true);
			//this.current_player.destroy(); // maybe?
			if (this.current_player!=null) this.current_player.destroy();
			//this.current_player.pause();
			var wp = this;
			var find_delay = 1000;
			if (immediately) find_delay = 1;
			if (this.change_ts_timeout!=null) {
				clearTimeout(this.change_ts_timeout);
				//this.change_ts_timeout = null;
			}
			this.change_ts_timeout = setTimeout(function() {
				wp.find_buffering_player(function(p) { wp.player_got(p); });
				wp.change_ts_timeout = null;
				wp.last_update = null;
				wp.update_state();
			}, find_delay);
		}
		var wp = this;
		this.update_state();
		//setTimeout(function() { wp.collect_garbage(); }, 100);
	};
	this.player_got = function(new_player) {
		console.log('got player '+new_player.descriptor.filename);
		/*if (wp.current_player!=null) {
			wp.current_player.deactivate();
		}*/
		new_player.activate();
		//new_player.play();
		//if (this.force_pause) new_player.player.pause();
		//wp.current_player = new_player;
		/*if (!wp.try_seek_current_player()) {
			console.log("try_seek_current_player failed for second time!");
			//log("Specified timestamp out of range, playing nearest.");
			log("Server returned file which doesn't contain requested timestamp. Bug?");
			wp.current_player.deactivate();
			wp.play_nearest();
		}*/
	};
	this.try_seek_current_player = function() {
		if (this.current_player==null) return false;
		/*if (this.current_player.is_ts_inside(this.ts_desired) {
			this.current_player.seek_to_ts(this.ts_desired);
			return true;
		} else {
			return false;
		}*/
		return this.current_player.seek_to_ts(this.ts_desired);
	};
	this.find_buffering_player = function(found) {
		if (!this.players.some(function(player, index, arr) {
			if (player==null) return false;
			if (player.is_ts_inside(this.ts_desired)) {
				console.log('found player! '+player.descriptor.filename);
				found(player);
				return true;
			}
		})) {
			console.log('player not found in cache, requesting one...');
			this.add_player_by_ts(this.ts_desired, found);
		}
	};
	this.get_player_by_recid = function(recid) {
		for (p of this.players) {
			if (p.descriptor.recid==recid) return p;
		}
		return null;
	};
	this.add_player_by_id = function(id, got_player) {
		this.add_player('get_file_by_recid', { recid: id }, got_player);
	};
	this.add_player_by_ts = function(ts, got_player) {
		this.add_player('get_file_by_ts', { ts: ts.getTime()/1000 }, got_player);
	};
	this.add_player = function(mode, args, got_player) {
		/*this.request('get_file_by_ts', ts, function(descriptor) {
			var p = new PartPlayer(descriptor, false);
			this.players.push(p);
			got_player(p);
		});*/
		var wp = this;
		return this.add_player_req(mode, args, got_player, 0).fail(function(xhr, text_status) {
			if (text_status=='abort') return;
			if (xhr.status==404) {
				console.log('get_file_by_ts failed with 404!');
				log("Timestamp out of range. Playing nearest recording.");
				wp.play_nearest();
			} else {
				log("Network or server error ("+text_status+" HTTP "+xhr.status+". Please contact server admin.");
			}
		});
	};
	this.play_nearest = function() {
		console.log('play_nearest...');
		if (this.ts_desired==null) {
			console.log('ts_desired==null in play_nearest() !');
			return;
		}
		var wp = this;
		this.add_player_req('get_file_first_after', { from: this.ts_desired.getTime()/1000 }, function(player) {
			console.log('got player from play_nearest!');
			player.activate();
		}, 0);
	}
	this.add_player_req = function(mode, args, got_player, channel) {
		if ((channel in this.requests) && (this.requests[channel]!=null)) {
			this.requests[channel].abort();
		}
		var wp = this;
		this.requests[channel] = this.request(mode, args, function(descriptor) {
			var p = new PartPlayer(descriptor, wp);
			wp.players.push(p);
			if (typeof got_player == 'function') got_player(p);
			wp.requests[channel] = null;
		});
		return this.requests[channel];
	};
	this.request = function(mode, args, callback) {
		args.mode = mode;
		args.format = $('#format_select').val();
		args.origin = $('#origin_select').val();
		return $.get('./get.php', args, callback, 'json');
	};
	this.player_ready = function() {
		this.ts_desired = null;
		this.last_update = null;
		this.update_state();
		this.update_address();
		var wp = this;
		setTimeout(function() { wp.collect_garbage(); }, 800);
	};
	this.get_current_ts = function() {
		if (this.current_player==null) return null;
		return this.current_player.get_current_ts();
	};
	this.get_stopped = function() {
		return ( (this.current_player==null) && (this.requests[0]==null) && (this.change_ts_timeout==null) );
	}
	this.update_state = function() {
		//return;
		//if (this.last_update==null) this.update_address();
		if ((this.last_update!=null) && ((Date.now()-this.last_update)<900)) return;
		this.last_update = Date.now();
		var cts = this.get_current_ts();
		//if ( (this.current_player==null) || ( (this.requests[0]==null) && ((cts==null) && (this.ts_desired==null)) ) {
		//if ( ( (cts==null) && (this.ts_desired==null) ) || ( (this.current_player==null) && (this.requests[0]==null) ) ) {
		if (this.get_stopped()) {
			$('#timedisplay').addClass('invalid');
		} else {
			$('#timedisplay').removeClass('invalid');
		}
		if ( ! ( this.change_ts_timeout==null ) ) {
			$('#timedisplay').addClass('delayed');
		} else {
			$('#timedisplay').removeClass('delayed');
		}
		var ts = null;
		if (this.ts_desired!=null) {
			ts = this.ts_desired;
			$('#timedisplay').addClass('desired');
			$('#download_container').slideUp();
			$('#download_show').attr('disabled', true);
		} else {
			ts = cts;
			$('#timedisplay').removeClass('desired');
			$('#download_show').attr('disabled', false);
		}
		//ts = this.get_user_ts();
		if (ts!=null) {
			$('#timedisplay .year .c').text(ts.getFullYear());
			$('#timedisplay .month .c').text(zeropad(ts.getMonth()+1));
			$('#timedisplay .day .c').text(zeropad(ts.getDate()));
			$('#timedisplay .hours .c').text(zeropad(ts.getHours()));
			$('#timedisplay .minutes .c').text(zeropad(ts.getMinutes()));
			$('#timedisplay .seconds .c').text(zeropad(ts.getSeconds()));
			var tzoffset = ts.getTimezoneOffset();
			var tzstr = '';
			if (tzoffset>0) {
				tzstr += '-';
			} else {
				tzstr += '+';
				tzoffset *= -1;
			}
			tzstr += ''+zeropad(Math.floor(tzoffset/60));
			tzstr += ''+zeropad(Math.floor(tzoffset%60));
			$('#timedisplay .tzstr .c').text(tzstr);
		} else {
			$('#timedisplay .hours .c, #timedisplay .minutes .c, #timedisplay .seconds .c, #timedisplay .day .c, #timedisplay .month .c').text('??');
			$('#timedisplay .year .c').text('????');
		}
		var t = '?';
		if (this.ts_desired==null) {
			if (this.current_player!=null) {
				if ((this.current_player.offset!=null) || (this.current_player.player.seeking) || (this.current_player.player.ended) || (this.current_player.player.currentTime==0)) {
					t = 'seek';
				} else if (this.current_player.player.paused) {
					t = 'PAUSE';
					/*var output = '';
					for (var property in this.current_player.player) {
						output += property + ': ' + this.current_player.player[property]+'; ';
					}
					console.log(output);*/
					//console.log(this.current_player.player);
				} else {
					t = 'PLAY';
				}
			} else {
				t = '-----';
			}
		} else {
			t = 'seek';
			if (this.requests[0]!=null) {
				t = 'fetch';
			} else if (cts!=null) {
				if (this.ts_desired>cts) {
					t = '>>>>>';
				} else if (this.ts_desired<cts) {
					t = '<<<<<';
				}
			} else if (this.current_player==null) {
				if (this.change_ts_timeout!=null) {
					t = 'seeking';
				} else {
					t = 'STOP';
				}
			}
		}
		if (this.force_pause) t+='/P.';
		$('#timedisplay .state .c').text(t);
		$('#timedisplay .volume .c').text((this.volume_db>0 ? '+' : '')+this.volume_db);
		setTimeout(function() { if (wp!=null) wp.lookahead(); }, 1);
	};
	this.lookahead = function() {
		var pp = this.current_player;
		if (pp==null) return;
		if ((pp.next_pp==null) && (pp.descriptor.nextid>0) && pp.is_near_end()) {
			for (var i=0; i<this.players.length; i++) {
				if (this.players[i].descriptor.recid==pp.descriptor.nextid) {
					pp.next_pp = this.players[i];
					break;
				}
			}
			if (pp.next_pp==null) {
				wp.add_player_req('get_file_by_recid', { recid: this.current_player.descriptor.nextid }, function(player) {
					pp.next_pp = player;
				}, 1);
			}
		}
	};
}
