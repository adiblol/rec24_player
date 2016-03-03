<?php

require_once('rec24config.php');

$pdo = new PDO('mysql:', NULL, NULL, array(
	PDO::MYSQL_ATTR_READ_DEFAULT_FILE => $db_conf_path,
	PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
	PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
));

function get_filename_and_offset($ts, $format, $origin) {
	global $pdo;
	$a = array();
	$q = $pdo->query('SELECT id, UNIX_TIMESTAMP(rec_start) AS rec_start, UNIX_TIMESTAMP(rec_end) AS rec_end, status FROM recordings WHERE origin='.(int)$origin.' AND rec_start<=FROM_UNIXTIME('.$ts.') AND ( ( rec_end>=FROM_UNIXTIME('.$ts.') ) OR ( status=\'recording\' ) ) ORDER BY CASE WHEN status=\'recording\' THEN 1 ELSE 0 END ASC LIMIT 1');
	$r = $q->fetch();
	if ($r) {
		//print_r($r);
		$a = get_fileinfo_by_recid($r['id'], $format, $origin);
		$offset = (int)($ts - $r['rec_start']);
		$a['offset'] = $offset;
	} else {
		$a = false;
	}
	return $a;

}

function get_fileinfo_by_recid($recid, $format, $origin) {
	global $pdo;
	$fq = $pdo->query('SELECT filename FROM rec_files WHERE recording_id='.$recid.' AND format_id='.$format);
	$fr = $fq->fetch();
	$rq = $pdo->query('SELECT UNIX_TIMESTAMP(rec_start) AS rec_start, UNIX_TIMESTAMP(rec_end) AS rec_end, previous_id, next_id, status FROM recordings WHERE id='.$recid);
	$rr = $rq->fetch();
	if ($fr) {
		$a['recid'] = (int)$recid;
		$a['filename'] = path_to_browser($fr['filename']);
		//if (!$rr['next_id']) $a['filename'] .= '?forcenocache='.time();
		$a['previd'] = (int)$rr['previous_id'];
		$a['nextid'] = (int)$rr['next_id'];
		$a['rec_start'] = (int)$rr['rec_start'];
		$a['rec_end'] = (int)$rr['rec_end'];
		$a['live'] = ( ($rr['status']=='recorded') ? 0 : 1 );
	} else {
		$a = false;
	}
	return $a;
}

function path_to_browser($p) {
	global $path_replace;
	foreach ($path_replace as $pre => $post) {
		$p = str_replace($pre, $post, $p);
	}
	return $p;
}

if ($_GET['mode']=='get_time') {
	print json_encode(array('ts' => time()));
} else if ($_GET['mode']=='get_origins') {
	$q = $pdo->query('SELECT id, name, title FROM origins;');
	print json_encode($q->fetchAll());
} else if ($_GET['mode']=='get_formats') {
	$q = $pdo->query('SELECT id, title, codec FROM formats;');
	print json_encode($q->fetchAll());
} else if ($_GET['mode']=='get_file_by_ts') {
	$a = get_filename_and_offset((int)$_GET['ts'], (int)$_GET['format'], (int)$_GET['origin']);
	if ($a) {
		print json_encode($a);
	} else {
		http_response_code(404);
	}
} else if ($_GET['mode']=='get_file_first_after') {
	$q = $pdo->query('SELECT id FROM recordings WHERE rec_start>=FROM_UNIXTIME('.(int)$_GET['from'].') ORDER BY rec_start ASC LIMIT 1');
	$r = $q->fetch();
	if ($r) {
		$id = $r['id'];
		$a = get_fileinfo_by_recid((int)$id, (int)$_GET['format'], (int)$_GET['origin']);
	} else {
		$a = null;
	}
	if ($a) {
		$a['offset'] = 0;
		print json_encode($a);
	} else {
		http_response_code(404);
	}
} else if ($_GET['mode']=='get_file_by_recid') {
	$a = get_fileinfo_by_recid((int)$_GET['recid'], (int)$_GET['format'], (int)$_GET['origin']);
	if ($a) {
		$a['offset'] = 0;
		print json_encode($a);
	} else {
		http_response_code(404);
	}
} else if ($_GET['mode']=='data') {
	$ts = (int)$_GET['ts'];
	$duration = (int)($_GET['duration']);
	$a = get_filename_and_offset($ts, (int)$_GET['format'], (int)$_GET['origin']);
	if ($a) {
		$c = 'avconv -ss '.$a['offset'].' -i '.$a['filename'].' -acodec copy -t '.$duration.' -f ogg -';
		//print $c;
		header('Content-type: audio/ogg');
		passthru($c);
	} else {
		http_response_code(404);
	}
	exit();
} else {
	http_response_code(400); // bad request
	print "invalid mode";
}
?>
