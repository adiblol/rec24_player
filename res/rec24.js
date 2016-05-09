var wp = null; // actually only for debugging ;)

var dump_players = function() {
	wp.players.forEach(function(p) {
		console.log(p.ts_start+' - '+p.ts_end);
	});
};

var log = function(msg) {
	console.log('!!! '+msg);
	var p = $(document.createElement('p'));
	p.text(msg);
	var logs = $('#log_dev .logs_inner');
	p.hide();
	logs.append(p);
	$('#log_dev .logs').scrollTop(logs.prop('scrollHeight'));
	$('#log_dev').slideDown();
	p.show('highlight');
}


$(window).load(function() {

	var player_ready = function() {
		var matches = document.location.hash.match(/^#([0-9]+)#(.+)$/);
		if (matches) {
			$('#origin_select').val(matches[1]);
			console.log(matches);
			wp.ts_desired = new Date(matches[2]);
			//wp.change_ts(0);
		} else {
			var hourago = new Date(Date.now()-3600000);
			wp.ts_desired = hourago;
			//wp.change_ts(0);
		}
		$('#loading_app').fadeOut();
		$('#player_dev').slideDown();
		setInterval(function() {
			var dt = wp.wallclock.get();
			$('.wallclock').text(dt2datestr(dt)+' '+dt2timestr(dt));
		}, 1000);
		wp.update_state();
	};
	var check_player_ready = function() {
		if (($('#origin_select option').length>0) && ($('#format_select option').length>0) && wp.wallclock.ready) {
			player_ready();
		} else {
			$('#loading_app p').append('.');
		}
	}

	$.get('./get.php', { mode: 'get_origins' }, function(origins) {
		$('#origin_select option').remove();
		$.each(origins, function(i, origin) {
			elem = $('<option></option>').text(origin.title).val(origin.id);
			console.log(elem);
			$('#origin_select').append(elem);
			if (i==0) {
				$('#origin_select').val(origin.id);
				console.log(origin.id);
			}
			console.log(origin);
		});
		check_player_ready();
	}, 'json');
	$.get('./get.php', { mode: 'get_formats' }, function(formats) {
		$('#format_select option').remove();
		$.each(formats, function(i, format) {
			elem = $('<option></option>').text(format.title).val(format.id);
			console.log(elem);
			$('#format_select').append(elem);
			if (format.codec=='vorbis') {
				$('#format_select').val(format.id);
				console.log(format.id);
			}
			console.log(format);
		});
		check_player_ready();
	}, 'json');
	$('#log_close').click(function() {
		$('#log_dev').slideUp();
	});
	$('#timedisplay .day .c, #timedisplay .timestr .c, #timedisplay .volume .c').parent().prepend('<span class="up">&#9650;</span><span class="down">&#9660;</span>');
	wp = new WebPlayer($('#maindiv'), function() { check_player_ready() });
	$('#format_select').change(function() {wp.playback_restart();});
	$('#origin_select').change(function() {wp.playback_restart();});
	$('#calendar').datepicker({inline: true, firstDay: 1});
	$('#calendar').datepicker("option", "dateFormat", 'yy-mm-dd');
	$('#vol_up').click(function() { wp.change_vol(1); });
	$('#vol_down').click(function() { wp.change_vol(-1); });
	var fill_set_time = function() {
		var ts = wp.get_user_ts();
		$('#calendar').val(dt2datestr(ts));
		$('#timeofday').val(dt2timestr(ts));
		$('#timezone').val($('#timedisplay .tzstr .c').text());
	};
	var hide_set_time = function() {
		$('#timedisplay input, #timedisplay button').hide();
	}
	/*$('#settime_show').click(function() {
		$('#settime').slideDown();
	});*/
	var confirm_set_time = function() {
		tsstr = $('#calendar').val()+'T'+$('#timeofday').val()+$('#timezone').val();
		wp.ts_desired = new Date(tsstr);
		wp.change_ts(0);
		hide_set_time();
	};
	$('#settime_go').click(function() {
		confirm_set_time();
	});

	$('#settime_cancel').click(function() {
		hide_set_time();
	});
	/*$('#timedisplay .timestr .c').click(function(ev) {
		$('#timeofday').fadeIn();
		return false;
	});
	$('#timedisplay .datestr .c').click(function(ev) {
		$('#calendar').fadeIn();
		return false;
	});*/
	$('#timedisplay .disp').click(function(ev) {
		//console.log(document.activeElement.tagName);
		if (!($(this).hasClass('inlineeditable'))) return true;
		if (document.activeElement.tagName=='INPUT') return true;
		fill_set_time();
		$('#timedisplay .disp input').fadeIn(); 
		$(this).closest('.disp').find('input').focus().select();

		$('#timedisplay button').fadeIn();
		return true;
	});
	$('#timedisplay input').keydown(function(ev) {
		if (ev.which==27) hide_set_time();
		if (ev.which==13) {
			confirm_set_time();
			//hide_set_time();
		}
	});


	$('#timedisplay .datestr').mousewheel(function(ev) { wp.change_ts(ev.deltaY*86400); });
	$('#timedisplay .hours').mousewheel(function(ev) { wp.change_ts(ev.deltaY*3600); });
	$('#timedisplay .minutes').mousewheel(function(ev) { wp.change_ts(ev.deltaY*60); });
	$('#timedisplay .seconds').mousewheel(function(ev) { wp.change_ts(ev.deltaY); });
	$('#timedisplay .volume').mousewheel(function(ev) { wp.change_vol(ev.deltaY); });

	$(document).keypress(function(e) {
		if ((e.target.tagName=='INPUT') || (e.target.tagName=='SELECT')) return true;
		var delta = 0;
		if (e.keyCode==37) delta = -10; else // left
		if (e.keyCode==39) delta = 10; else  // right
		if (e.keyCode==40) delta = -60; else // down
		if (e.keyCode==38) delta = 60; else  // up
		if (e.keyCode==34) delta = -600; else // pgDn
		if (e.keyCode==33) delta = 600; else  // pgUp
		if (e.key=='/') wp.change_vol(-1); else
		if (e.key=='*') wp.change_vol(1); else
		if (e.key==',') delta = -3600; else
		if (e.key=='.') delta = 3600; else
		if (e.key=='n') delta = -86400; else
		if (e.key=='m') delta = 86400; else
		if (e.key=='e') $('#timedisplay .datestr').click(); else
		if (e.key==' ') wp.playpause(); else
			return true;
		if (delta!=0) wp.change_ts(delta);
		e.preventDefault();
	});


	$('#timedisplay .volume .up').click(function(ev) { wp.change_vol(1); return false; });
	$('#timedisplay .volume .down').click(function(ev) { wp.change_vol(-1); return false; });

	var ts_parts = $('#timedisplay').find('.hours, .minutes, .seconds, .day');
	ts_parts.find('.up, .down').click(function() {
		var m = 0;
		if ($(this).hasClass('up')) m = 1.0;
		if ($(this).hasClass('down')) m = -1.0;
		wp.change_ts(m*$(this).closest('[data-tsd]').data('tsd'));
		hide_set_time();
		return false;
	});
	$('#playpause, #timedisplay .state').click(function() {wp.playpause();});
	$('#stop').click(function() { wp.stop(); });

	$('#download_show').click(function() {
		if (wp.current_player==null) return;
		$('#download_container').slideDown();
		$('#download_format').remove();
		var elem = $('#format_select').clone();
		elem.attr('id', 'download_format');
		elem.change(function() {
			$('#download_content').hide();
			var offset_min = Math.floor(wp.current_player.player.currentTime/60);
			var offset_sec = Math.floor(wp.current_player.player.currentTime%60);
			$('#download_offset').text(offset_min+'m '+offset_sec+'s');

			$.get('./get.php', { 'mode': 'get_file_by_recid', 'origin': $('#origin_select').val(), 'format': $('#download_format').val(), 'recid': wp.current_player.descriptor.recid }, function(result) {
				$('#download_link').attr('href', result.filename);
				$('#download_link').text('Right click and \'save link location\' to download');
				$('#download_link').click(function() { return true; });
				$('#download_content').fadeIn();
			}, 'json').error(function() {
				$('#download_link').attr('href', '');
				$('#download_link').text('Download unavailable :(');
				$('#download_link').click(function() { return false; });
				$('#download_content').fadeIn();
			});
		});
		$('#download_content').before(elem);
		elem.change();
	});
	$('#download_hide').click(function() {
		$('#download_container').slideUp();
	});

});
