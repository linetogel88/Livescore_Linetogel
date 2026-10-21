<?php
/**
 * Plugin Name: LIVE SCORE LINETOGEL
 * Plugin URI: https://lineblog953.com/
 * Description: Live score LINETOGEL modern untuk WordPress dengan UI original LINETOGEL + match card premium + High Traffic Mode, shared cache, REST cacheable endpoint, logo tim dan timezone WIB.
 * Version: 3.8.1
 * Author: LINETOGEL
 * License: GPL-2.0-or-later
 * Text Domain: live-score-linetogel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class LSL_Live_Score_254 {

	const VERSION = '3.8.1';

	/**
	 * Tetap menggunakan nama option versi sebelumnya
	 * agar API Key / logo yang sudah tersimpan tidak hilang.
	 */
	const OPTION_NAME = 'lsl24_settings';

	const AJAX_ACTION        = 'lsl254_get_scores';
	const MINUTE_AJAX_ACTION = 'lsl254_get_live_minutes';
	const NONCE_ACTION       = 'lsl254_scores_nonce';

	const TEST_ACTION = 'lsl254_test_football_data';
	const TEST_NONCE  = 'lsl254_test_nonce';

	const TIMEZONE = 'Asia/Jakarta';

	const FRONT_CACHE_TTL       = 20;
	const SCHEDULE_CACHE_TTL    = 300;
	const KICKOFF_GRACE         = 600;

	/* High Traffic Mode: satu snapshot dipakai bersama semua visitor. */
	const HIGH_TRAFFIC_MODE     = true;
	const STALE_CACHE_TTL       = 180;
	const CACHE_LOCK_TTL        = 18;
	const REST_EDGE_CACHE_TTL   = 20;

	/**
	 * Database logo Football.
	 */
	const LOGO_DB_BASE = 'https://linetogel88.github.io/bola_linetogel/';

	/**
	 * Logo brand utama LINETOGEL.
	 */
	const BRAND_LOGO_URL = 'https://cdn.areabermain.club/assets/cdn/az6/2026/07/25/20260725/f3fa85abe469ac91f803335bf025c6d1/logo-line.png';

	/**
	 * Link direct utama LINETOGEL.
	 */
	const DIRECT_URL = 'https://linklist.bio/VVCIApFHZw';

	private static $sports = array(
		'football'   => 'Football',
		'hockey'     => 'Hockey',
		'basketball' => 'Basketball',
		'tennis'     => 'Tennis',
		'cricket'    => 'Cricket',
	);

	private static $datasets = array(
		'football'   => 'football',
		'hockey'     => 'ice-hockey',
		'basketball' => 'basketball',
		'tennis'     => 'tennis',
		'cricket'    => 'cricket',
	);

	private static $css_printed = false;

	/**
	 * =========================================================
	 * INIT
	 * =========================================================
	 */
	public function __construct() {

		add_shortcode(
			'livescore_linetogel',
			array( $this, 'render_shortcode' )
		);

		add_action(
			'wp_ajax_' . self::AJAX_ACTION,
			array( $this, 'ajax_get_scores' )
		);

		add_action(
			'wp_ajax_nopriv_' . self::AJAX_ACTION,
			array( $this, 'ajax_get_scores' )
		);

		add_action(
			'wp_ajax_' . self::MINUTE_AJAX_ACTION,
			array( $this, 'ajax_get_live_minutes' )
		);

		add_action(
			'wp_ajax_nopriv_' . self::MINUTE_AJAX_ACTION,
			array( $this, 'ajax_get_live_minutes' )
		);

		add_action(
			'admin_menu',
			array( $this, 'admin_menu' )
		);

		add_action(
			'admin_init',
			array( $this, 'register_settings' )
		);

		add_action(
			'wp_ajax_' . self::TEST_ACTION,
			array( $this, 'ajax_test_api' )
		);

		/* Endpoint GET publik yang dapat dicache CDN/reverse proxy. */
		add_action(
			'rest_api_init',
			array( $this, 'register_rest_routes' )
		);
	}

	/**
	 * =========================================================
	 * ADMIN
	 * =========================================================
	 */
	public function admin_menu() {

		add_options_page(
			'Live Score Linetogel',
			'Live Score Linetogel',
			'manage_options',
			'live-score-linetogel',
			array( $this, 'settings_page' )
		);
	}

	public function register_settings() {

		register_setting(
			'lsl254_settings_group',
			self::OPTION_NAME,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize_settings' ),
				'default'           => array(),
			)
		);
	}

	public function sanitize_settings( $input ) {

		$current = $this->get_settings();

		$output = array(
			'football_data_key' => $current['football_data_key'],
			'brand_name'        => $current['brand_name'],
			'logo_url'          => $current['logo_url'],
			'direct_url'        => $current['direct_url'],
			'accent_color'      => $current['accent_color'],
		);

		if ( ! is_array( $input ) ) {
			return $output;
		}

		if ( isset( $input['football_data_key'] ) ) {

			$key = trim(
				(string) $input['football_data_key']
			);

			$key = str_replace(
				array( "\r", "\n" ),
				'',
				$key
			);

			$output['football_data_key'] =
				sanitize_text_field( $key );
		}

		if ( isset( $input['brand_name'] ) ) {

			$output['brand_name'] =
				sanitize_text_field(
					(string) $input['brand_name']
				);
		}

		if ( isset( $input['logo_url'] ) ) {

			$output['logo_url'] =
				esc_url_raw(
					(string) $input['logo_url']
				);
		}

		if ( isset( $input['direct_url'] ) ) {

			$direct_url = esc_url_raw(
				(string) $input['direct_url']
			);

			$output['direct_url'] = $direct_url
				? $direct_url
				: self::DIRECT_URL;
		}

		if ( isset( $input['accent_color'] ) ) {

			$color =
				sanitize_hex_color(
					(string) $input['accent_color']
				);

			if ( $color ) {
				$output['accent_color'] = $color;
			}
		}

		$this->clear_current_cache();

		return $output;
	}

	private function get_settings() {

		$settings =
			get_option(
				self::OPTION_NAME,
				array()
			);

		if ( ! is_array( $settings ) ) {
			$settings = array();
		}

		$settings = wp_parse_args(
			$settings,
			array(
				'football_data_key' => '',
				'brand_name'        => 'LINETOGEL',
				'logo_url'          => self::BRAND_LOGO_URL,
				'direct_url'        => self::DIRECT_URL,
				'accent_color'      => '#d946ef',
			)
		);

		if ( empty( $settings['logo_url'] ) ) {
			$settings['logo_url'] = self::BRAND_LOGO_URL;
		}

		if ( empty( $settings['direct_url'] ) ) {
			$settings['direct_url'] = self::DIRECT_URL;
		}

		return $settings;
	}

	private function clear_current_cache() {

		foreach (
			array_keys( self::$sports )
			as $sport
		) {

			delete_transient(
				'lsl254_front_' .
				md5(
					$sport .
					'|' .
					$this->today_key()
				)
			);
		}

		foreach (
			self::$datasets
			as $dataset
		) {

			delete_transient(
				'lsl254_dataset_' .
				md5(
					$dataset .
					'|' .
					$this->today_key()
				)
			);
		}

		$range =
			$this->football_data_date_range();

		delete_transient(
			'lsl254_fd_' .
				md5(
					$range['from'] .
					'|' .
					$range['to']
				)
		);
	}

	public function settings_page() {

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$settings = $this->get_settings();

		$nonce =
			wp_create_nonce(
				self::TEST_NONCE
			);

		?>
		<div class="wrap">

			<h1>LIVE SCORE LINETOGEL</h1>

			<div style="
				max-width:900px;
				padding:18px 20px;
				margin:20px 0;
				background:#fff;
				border-left:4px solid #d946ef;
			">

				<h2 style="margin-top:0;">
					Versi 3.8.1 High Traffic Mode
				</h2>

				<p>
					Live Score modern LINETOGEL + responsive scoreboard + Database Logo +
					Multi Provider + AJAX Refresh.
				</p>

				<p>
					<strong>Shortcode:</strong>
					<code>[livescore_linetogel]</code>
				</p>

			</div>

			<form
				method="post"
				action="options.php"
			>

				<?php
				settings_fields(
					'lsl254_settings_group'
				);
				?>

				<table class="form-table">

					<tr>

						<th scope="row">
							<label for="lsl254-key">
								football-data.org API Key
							</label>
						</th>

						<td>

							<input
								type="password"
								id="lsl254-key"
								name="lsl24_settings[football_data_key]"
								value="<?php echo esc_attr( $settings['football_data_key'] ); ?>"
								class="regular-text"
								autocomplete="new-password"
							>

							<p class="description">
								API key hanya digunakan di server WordPress.
							</p>

						</td>

					</tr>

					<tr>

						<th scope="row">
							Nama Brand
						</th>

						<td>

							<input
								type="text"
								name="lsl24_settings[brand_name]"
								value="<?php echo esc_attr( $settings['brand_name'] ); ?>"
								class="regular-text"
							>

						</td>

					</tr>

					<tr>

						<th scope="row">
							URL Logo Brand
						</th>

						<td>

							<input
								type="url"
								name="lsl24_settings[logo_url]"
								value="<?php echo esc_url( $settings['logo_url'] ); ?>"
								class="regular-text"
								placeholder="https://domain.com/logo.png"
							>

							<p class="description">
								Upload logo melalui Media WordPress lalu paste URL file di sini.
							</p>

						</td>

					</tr>

					<tr>

						<th scope="row">
							Link Direct LINETOGEL
						</th>

						<td>

							<input
								type="url"
								name="lsl24_settings[direct_url]"
								value="<?php echo esc_url( $settings['direct_url'] ); ?>"
								class="regular-text"
								placeholder="https://linklist.bio/..."
							>

							<p class="description">
								Dipakai untuk klik logo dan tombol Kunjungi LINETOGEL di halaman Live Score.
							</p>

						</td>

					</tr>

					<tr>

						<th scope="row">
							Warna Neon
						</th>

						<td>

							<input
								type="color"
								name="lsl24_settings[accent_color]"
								value="<?php echo esc_attr( $settings['accent_color'] ); ?>"
							>

						</td>

					</tr>

				</table>

				<?php
				submit_button(
					'Simpan Pengaturan'
				);
				?>

			</form>

			<hr>

			<h2>Tes football-data.org</h2>

			<button
				type="button"
				id="lsl254-test"
				class="button button-secondary"
			>
				Tes API
			</button>

			<span
				id="lsl254-result"
				style="
					margin-left:10px;
					font-weight:600;
				"
			></span>

		</div>

		<script>
		document.addEventListener(
			'DOMContentLoaded',
			function(){

				const button =
					document.getElementById(
						'lsl254-test'
					);

				const result =
					document.getElementById(
						'lsl254-result'
					);

				if(!button || !result){
					return;
				}

				button.addEventListener(
					'click',
					async function(){

						button.disabled = true;

						result.style.color =
							'#555';

						result.textContent =
							'Menguji koneksi...';

						const form =
							new URLSearchParams();

						form.set(
							'action',
							'<?php echo esc_js( self::TEST_ACTION ); ?>'
						);

						form.set(
							'nonce',
							'<?php echo esc_js( $nonce ); ?>'
						);

						try{

							const response =
								await fetch(
									ajaxurl,
									{
										method:'POST',

										headers:{
											'Content-Type':
												'application/x-www-form-urlencoded; charset=UTF-8'
										},

										body:
											form.toString()
									}
								);

							const json =
								await response.json();

							if(!json.success){

								throw new Error(
									json.data &&
									json.data.message
										? json.data.message
										: 'Tes API gagal.'
								);
							}

							result.style.color =
								'#008a20';

							result.textContent =
								json.data.message;

						}catch(error){

							result.style.color =
								'#d63638';

							result.textContent =
								error.message;

						}finally{

							button.disabled =
								false;
						}
					}
				);
			}
		);
		</script>
		<?php
	}

	public function ajax_test_api() {

		check_ajax_referer(
			self::TEST_NONCE,
			'nonce'
		);

		if (
			! current_user_can(
				'manage_options'
			)
		) {

			wp_send_json_error(
				array(
					'message' =>
						'Tidak memiliki izin.',
				),
				403
			);
		}

		$json =
			$this->request_football_data();

		if ( is_wp_error( $json ) ) {

			wp_send_json_error(
				array(
					'message' =>
						$json->get_error_message(),
				)
			);
		}

		$count =
			isset( $json['matches'] ) &&
			is_array( $json['matches'] )
				? count( $json['matches'] )
				: 0;

		wp_send_json_success(
			array(
				'message' =>
					sprintf(
						'Koneksi berhasil. %d pertandingan diterima.',
						$count
					),
			)
		);
	}

	/**
	 * =========================================================
	 * TIMEZONE WIB
	 * =========================================================
	 */
	private function timezone() {

		return new DateTimeZone(
			self::TIMEZONE
		);
	}

	private function today_key() {

		return wp_date(
			'Y-m-d',
			null,
			$this->timezone()
		);
	}

	private function today_label() {

		$months = array(
			1  => 'Januari',
			2  => 'Februari',
			3  => 'Maret',
			4  => 'April',
			5  => 'Mei',
			6  => 'Juni',
			7  => 'Juli',
			8  => 'Agustus',
			9  => 'September',
			10 => 'Oktober',
			11 => 'November',
			12 => 'Desember',
		);

		$timestamp = time();

		$day =
			(int) wp_date(
				'j',
				$timestamp,
				$this->timezone()
			);

		$month =
			(int) wp_date(
				'n',
				$timestamp,
				$this->timezone()
			);

		$year =
			wp_date(
				'Y',
				$timestamp,
				$this->timezone()
			);

		return sprintf(
			'%d %s %s',
			$day,
			isset( $months[ $month ] )
				? $months[ $month ]
				: '',
			$year
		);
	}

	/**
	 * TODAY murni berdasarkan kalender WIB:
	 * 00:00:00 sampai 23:59:59 pada tanggal hari ini.
	 * Tidak membawa pertandingan besok dini hari ke daftar Today.
	 */
	private function matchday_window() {

		$now = new DateTimeImmutable(
			'now',
			$this->timezone()
		);

		$start = $now->setTime( 0, 0, 0 );
		$end   = $now->setTime( 23, 59, 59 );

		return array(
			'start' => $start->getTimestamp(),
			'end'   => $end->getTimestamp(),
		);
	}

	private function inside_matchday( $timestamp ) {

		if ( ! $timestamp ) {
			return false;
		}

		$window =
			$this->matchday_window();

		return (
			$timestamp >= $window['start'] &&
			$timestamp <= $window['end']
		);
	}

	private function next_morning( $timestamp ) {

		if ( ! $timestamp ) {
			return false;
		}

		return (
			wp_date(
				'Y-m-d',
				$timestamp,
				$this->timezone()
			) !==
			$this->today_key()
		);
	}

	private function football_data_date_range() {

		$window =
			$this->matchday_window();

		return array(
			'from' =>
				gmdate(
					'Y-m-d',
					$window['start']
				),

			'to' =>
				gmdate(
					'Y-m-d',
					$window['end']
				),
		);
	}

	/**
	 * =========================================================
	 * HIGH TRAFFIC MODE / CACHEABLE REST
	 * =========================================================
	 */
	public function register_rest_routes() {

		register_rest_route(
			'live-score-linetogel/v1',
			'/scores/(?P<sport>[a-z-]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_get_scores' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'sport' => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);
	}

	public function rest_get_scores( $request ) {

		$sport = sanitize_key( (string) $request->get_param( 'sport' ) );

		if ( ! isset( self::$sports[ $sport ] ) ) {
			return new WP_Error(
				'lsl254_invalid_sport',
				'Cabang olahraga tidak valid.',
				array( 'status' => 400 )
			);
		}

		$result = $this->get_scores( $sport );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$response = rest_ensure_response( $result );
		$ttl = absint( self::REST_EDGE_CACHE_TTL );
		$response->header( 'Cache-Control', 'public, max-age=5, s-maxage=' . $ttl . ', stale-while-revalidate=60, stale-if-error=180' );
		$response->header( 'CDN-Cache-Control', 'public, s-maxage=' . $ttl . ', stale-while-revalidate=60, stale-if-error=180' );
		$response->header( 'X-LSL-High-Traffic', '1' );
		$response->header( 'ETag', '"' . md5( wp_json_encode( $result ) ) . '"' );
		return $response;
	}

	private function front_cache_key( $sport ) {
		return 'lsl254_front_' . md5( $sport . '|' . $this->today_key() );
	}

	private function front_stale_cache_key( $sport ) {
		return 'lsl254_front_stale_' . md5( $sport . '|' . $this->today_key() );
	}

	private function front_lock_key( $sport ) {
		return 'lsl254_front_lock_' . md5( $sport . '|' . $this->today_key() );
	}

	private function acquire_front_lock( $sport ) {
		$key = $this->front_lock_key( $sport );
		$ttl = absint( self::CACHE_LOCK_TTL );
		$now = time();

		if ( function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache() ) {
			return (bool) wp_cache_add( $key, $now, 'lsl254', $ttl );
		}

		$option = '_lsl254_lock_' . md5( $key );
		$current = get_option( $option, false );
		if ( false !== $current && ( $now - absint( $current ) ) < $ttl ) {
			return false;
		}
		if ( false !== $current ) {
			delete_option( $option );
		}
		return (bool) add_option( $option, (string) $now, '', 'no' );
	}

	private function release_front_lock( $sport ) {
		$key = $this->front_lock_key( $sport );
		if ( function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache() ) {
			wp_cache_delete( $key, 'lsl254' );
		}
		delete_option( '_lsl254_lock_' . md5( $key ) );
	}

	private function stale_result( $result, $state = 'stale' ) {
		if ( ! is_array( $result ) ) {
			return $result;
		}
		$result['cache_state'] = sanitize_key( $state );
		$result['high_traffic'] = true;
		return $result;
	}

	/**
	 * =========================================================
	 * AJAX FRONTEND (fallback compatibility)
	 * =========================================================
	 */
	public function ajax_get_scores() {

		$valid =
			check_ajax_referer(
				self::NONCE_ACTION,
				'nonce',
				false
			);

		if ( ! $valid ) {

			wp_send_json_error(
				array(
					'message' =>
						'Permintaan tidak valid.',
				),
				403
			);
		}

		$sport =
			isset( $_POST['sport'] )
				? sanitize_key(
					wp_unslash(
						$_POST['sport']
					)
				)
				: '';

		if (
			! isset(
				self::$sports[ $sport ]
			)
		) {

			wp_send_json_error(
				array(
					'message' =>
						'Cabang olahraga tidak valid.',
				),
				400
			);
		}

		$result =
			$this->get_scores(
				$sport
			);

		if ( is_wp_error( $result ) ) {

			wp_send_json_error(
				array(
					'message' =>
						$result->get_error_message(),
				),
				502
			);
		}

		wp_send_json_success(
			$result
		);
	}

	/**
	 * =========================================================
	 * AJAX MENIT LIVE FOOTBALL - SPORTSCORE REFERENCE
	 * =========================================================
	 * Endpoint ringan yang hanya mengambil menit pertandingan LIVE.
	 * Frontend memanggil endpoint ini setiap 15 detik tanpa render ulang tabel.
	 */
public function ajax_get_live_minutes() {

	$valid = check_ajax_referer(
		self::NONCE_ACTION,
		'nonce',
		false
	);

	if ( ! $valid ) {
		wp_send_json_error(
			array( 'message' => 'Permintaan tidak valid.' ),
			403
		);
	}

	$sport = isset( $_POST['sport'] )
		? sanitize_key( wp_unslash( $_POST['sport'] ) )
		: '';

	if ( 'football' !== $sport ) {
		wp_send_json_success(
			array(
				'minutes'     => array(),
				'updated_wib' => wp_date( 'H:i:s', null, $this->timezone() ),
			)
		);
	}

	$raw = isset( $_POST['matches'] )
		? wp_unslash( $_POST['matches'] )
		: '';

	$requested = json_decode( (string) $raw, true );
	if ( ! is_array( $requested ) || empty( $requested ) ) {
		wp_send_json_success(
			array(
				'minutes'     => array(),
				'updated_wib' => wp_date( 'H:i:s', null, $this->timezone() ),
			)
		);
	}

	$requested = array_slice( $requested, 0, 80 );

	/*
	 * Satu snapshot halaman LIVE dipakai bersama untuk semua pertandingan.
	 * Kalau HTML reference gagal di hosting tertentu, fallback JSON resmi
	 * (tracker / match detail) tetap berjalan per pertandingan.
	 */
	$live_source = $this->get_sportscore_live_page_structured();
	$lines = array();
	$plain = '';
	$page_ok = false;

	if ( ! is_wp_error( $live_source ) && is_array( $live_source ) ) {
		$lines = ! empty( $live_source['lines'] ) && is_array( $live_source['lines'] )
			? $live_source['lines']
			: array();
		$plain = isset( $live_source['plain'] ) ? (string) $live_source['plain'] : '';
		$page_ok = ! empty( $lines );
	}

	$output = array();
	$resolved_any = false;

	foreach ( $requested as $item ) {
		if ( ! is_array( $item ) ) {
			continue;
		}

		$home = isset( $item['home'] )
			? sanitize_text_field( (string) $item['home'] )
			: '';
		$away = isset( $item['away'] )
			? sanitize_text_field( (string) $item['away'] )
			: '';
		$competition = isset( $item['competition'] )
			? sanitize_text_field( (string) $item['competition'] )
			: '';
		$sportscore_id = isset( $item['sportscore_id'] )
			? preg_replace( '/[^0-9]/', '', (string) $item['sportscore_id'] )
			: '';
		$sportscore_slug = isset( $item['sportscore_slug'] )
			? sanitize_title( (string) $item['sportscore_slug'] )
			: '';

		if ( '' === $home || '' === $away ) {
			continue;
		}

		$minute = '';
		$source = '';

		/* 1) Reference page — paling dekat dengan angka yang terlihat user. */
		if ( $page_ok ) {
			$minute = $this->find_sportscore_live_minute_lines(
				$lines,
				$home,
				$away,
				$competition
			);
			if ( '' !== $minute ) {
				$source = 'reference';
			}
		}

		/* 2) Parser plain sebagai fallback untuk struktur HTML alternatif. */
		if ( '' === $minute && '' !== $plain ) {
			$minute = $this->find_sportscore_live_minute(
				$plain,
				$home,
				$away
			);
			if ( '' !== $minute ) {
				$source = 'reference-plain';
			}
		}

		/* 3) Tracker JSON resmi bila ID SportScore tersedia. */
		if ( '' === $minute && '' !== $sportscore_id ) {
			$minute = $this->get_sportscore_tracker_minute( $sportscore_id );
			if ( '' !== $minute ) {
				$source = 'tracker';
			}
		}

		/* 4) Detail JSON resmi dari slug asli. */
		if ( '' === $minute && '' !== $sportscore_slug ) {
			$minute = $this->get_sportscore_detail_minute( $sportscore_slug );
			if ( '' !== $minute ) {
				$source = 'detail';
			}
		}

		/*
		 * 5) Bila endpoint compact tidak membawa slug, bentuk kandidat slug
		 * dari pasangan tim. SportScore mendokumentasikan pola home-vs-away.
		 */
		if ( '' === $minute ) {
			$slug_candidates = array_unique(
				array_filter(
					array(
						sanitize_title( $home . '-vs-' . $away ),
						sanitize_title( $away . '-vs-' . $home ),
					)
				)
			);

			foreach ( $slug_candidates as $candidate_slug ) {
				if ( '' !== $sportscore_slug && $candidate_slug === $sportscore_slug ) {
					continue;
				}
				$minute = $this->get_sportscore_detail_minute( $candidate_slug );
				if ( '' !== $minute ) {
					$source = 'detail-guessed';
					break;
				}
			}
		}

		$cache_match = array(
			'home'          => $home,
			'away'          => $away,
			'sportscore_id' => $sportscore_id,
		);
		$last_key = $this->sportscore_last_minute_cache_key( $cache_match );

		if ( '' !== $minute ) {
			$minute = $this->normalize_sportscore_minute_value( $minute );
		}

		if ( '' !== $minute ) {
			$resolved_any = true;
			set_transient(
				$last_key,
				array(
					'minute'    => $minute,
					'synced_at' => time(),
					'source'    => $source,
				),
				10 * MINUTE_IN_SECONDS
			);
		} else {
			/* Jangan hilangkan snapshot valid terakhir akibat satu request gagal. */
			$last = get_transient( $last_key );
			if (
				is_array( $last ) &&
				! empty( $last['minute'] ) &&
				! empty( $last['synced_at'] ) &&
				( time() - absint( $last['synced_at'] ) ) <= ( 10 * MINUTE_IN_SECONDS )
			) {
				$minute = $this->normalize_sportscore_minute_value( $last['minute'] );
				$source = 'last-valid';
			}
		}

		if ( '' === $minute ) {
			continue;
		}

		$output[] = array(
			'home'   => $home,
			'away'   => $away,
			'minute' => $minute,
			'source' => $source,
		);
	}

	wp_send_json_success(
		array(
			'minutes'     => $output,
			'updated_wib' => wp_date( 'H:i:s', null, $this->timezone() ),
			'source_ok'   => ( $page_ok || $resolved_any ),
		)
	);
}

	/**
	 * =========================================================
	 * DATA UTAMA
	 * =========================================================
	 */
	private function get_scores( $sport ) {

		$cache_key = $this->front_cache_key( $sport );
		$stale_key = $this->front_stale_cache_key( $sport );
		$cached = get_transient( $cache_key );

		if ( false !== $cached && is_array( $cached ) ) {
			$cached['cache_state'] = 'fresh';
			$cached['high_traffic'] = self::HIGH_TRAFFIC_MODE;
			return $cached;
		}

		$stale = get_transient( $stale_key );
		$has_lock = $this->acquire_front_lock( $sport );

		if ( ! $has_lock ) {
			if ( is_array( $stale ) ) {
				return $this->stale_result( $stale, 'stale-while-refresh' );
			}

			for ( $wait = 0; $wait < 4; $wait++ ) {
				usleep( 100000 );
				$warming = get_transient( $cache_key );
				if ( is_array( $warming ) ) {
					$warming['cache_state'] = 'fresh-after-wait';
					$warming['high_traffic'] = true;
					return $warming;
				}
			}

			return new WP_Error(
				'lsl254_cache_warming',
				'Live score sedang memperbarui snapshot. Silakan coba lagi sebentar.',
				array( 'status' => 503 )
			);
		}

		$sources =
			array();

		$warnings =
			array();

		$successful_sources =
			0;

		/**
		 * Sporting Events.
		 */
		$schedule =
			$this->get_sporting_events(
				$sport
			);

		if ( is_wp_error( $schedule ) ) {

			$warnings[] =
				$schedule->get_error_message();

		} else {

			++$successful_sources;

			$sources[] =
				$schedule;
		}

		/**
		 * football-data.org khusus Football.
		 */
		if ( 'football' === $sport ) {

			$football_data =
				$this->get_football_data_matches();

			if ( is_wp_error( $football_data ) ) {

				$warnings[] =
					$football_data->get_error_message();

			} else {

				++$successful_sources;

				$sources[] =
					$football_data;
			}
		}

		/**
		 * Provider live.
		 */
		if ( 'hockey' === $sport ) {

			$live =
				$this->get_nhl();

		} else {

			$live =
				$this->get_sportscore(
					$sport
				);
		}

		if ( is_wp_error( $live ) ) {

			$warnings[] =
				$live->get_error_message();

		} else {

			++$successful_sources;

			$sources[] =
				$live;
		}

		if ( 0 === $successful_sources ) {

			$this->release_front_lock( $sport );
			if ( is_array( $stale ) ) {
				$stale['partial'] = true;
				return $this->stale_result( $stale, 'stale-if-error' );
			}

			return new WP_Error(
				'lsl254_all_sources_failed',
				'Semua sumber data sedang tidak tersedia.'
			);
		}

		$matches =
			$this->merge_sources(
				$sources
			);

		/**
		 * FINAL GUARD: hanya pertandingan TODAY WIB yang dikirim ke frontend.
		 * Berlaku untuk semua provider setelah merge.
		 */
		$matches = array_values(
			array_filter(
				$matches,
				function ( $match ) {
					return (
						is_array( $match ) &&
						! empty( $match['start_ts'] ) &&
						$this->inside_matchday( (int) $match['start_ts'] )
					);
				}
			)
		);

		foreach (
			$matches
			as &$match
		) {

			$match =
				$this->reconcile_status(
					$match
				);
		}

		unset( $match );

		/*
		 * Football mendapat minute snapshot saat load utama juga, sehingga
		 * angka LIVE sudah tersedia sebelum polling 15 detik pertama.
		 */
		if ( 'football' === $sport ) {
			$matches = $this->enrich_sportscore_live_minutes( $matches );
		}

		$matches =
			$this->sort_matches(
				$matches
			);

		$live_count =
			0;

		$competitions =
			array();

		foreach (
			$matches
			as $match
		) {

			if (
				isset( $match['state'] ) &&
				'live' === $match['state']
			) {

				++$live_count;
			}

			if (
				! empty(
					$match['competition']
				)
			) {

				$competitions[
					strtolower(
						$match['competition']
					)
				] = true;
			}
		}

		$result = array(
			'matches' =>
				$matches,

			'live_count' =>
				$live_count,

			'league_count' =>
				count(
					$competitions
				),

			'today_label' =>
				$this->today_label(),

			'updated_wib' =>
				wp_date(
					'H:i:s',
					null,
					$this->timezone()
				),

			'partial' =>
				! empty(
					$warnings
				),
		);

		$result['cache_state'] = 'rebuilt';
		$result['high_traffic'] = self::HIGH_TRAFFIC_MODE;

		set_transient(
			$cache_key,
			$result,
			self::FRONT_CACHE_TTL
		);
		set_transient(
			$stale_key,
			$result,
			self::STALE_CACHE_TTL
		);
		$this->release_front_lock( $sport );

		return $result;
	}

	private function reconcile_status( $match ) {

		if (
			empty(
				$match['start_ts']
			) ||
			empty(
				$match['state']
			)
		) {
			return $match;
		}

		if (
			'upcoming' !==
				$match['state']
		) {
			return $match;
		}

		$elapsed =
			time() -
			(int) $match['start_ts'];

		if (
			$elapsed >
				self::KICKOFF_GRACE
		) {

			$match['state'] =
				'other';

			$match['status'] =
				'Menunggu Update';
		}

		return $match;
	}

	/**
	 * =========================================================
	 * HTTP
	 * =========================================================
	 */
	private function remote_json(
		$url,
		$provider,
		$headers = array()
	) {

		$headers =
			array_merge(
				array(
					'Accept' =>
						'application/json',

					'User-Agent' =>
						sprintf(
							'LIVE-SCORE-LINETOGEL/%s; %s',
							self::VERSION,
							home_url( '/' )
						),
				),
				$headers
			);

		$response =
			wp_safe_remote_get(
				$url,
				array(
					'timeout' =>
						20,

					'redirection' =>
						3,

					'sslverify' =>
						true,

					'headers' =>
						$headers,
				)
			);

		if (
			is_wp_error(
				$response
			)
		) {

			return new WP_Error(
				'lsl254_connection',
				sprintf(
					'Koneksi ke %s gagal.',
					$provider
				)
			);
		}

		$code =
			wp_remote_retrieve_response_code(
				$response
			);

		if ( 401 === $code ) {

			return new WP_Error(
				'lsl254_401',
				sprintf(
					'Autentikasi %s ditolak.',
					$provider
				)
			);
		}

		if ( 403 === $code ) {

			return new WP_Error(
				'lsl254_403',
				sprintf(
					'Akses %s ditolak.',
					$provider
				)
			);
		}

		if ( 429 === $code ) {

			return new WP_Error(
				'lsl254_429',
				sprintf(
					'Limit %s tercapai.',
					$provider
				)
			);
		}

		if (
			$code < 200 ||
			$code >= 300
		) {

			return new WP_Error(
				'lsl254_http',
				sprintf(
					'%s HTTP %d.',
					$provider,
					absint( $code )
				)
			);
		}

		$body =
			wp_remote_retrieve_body(
				$response
			);

		if (
			'' ===
				trim(
					$body
				)
		) {

			return new WP_Error(
				'lsl254_empty',
				sprintf(
					'%s tidak mengembalikan data.',
					$provider
				)
			);
		}

		$json =
			json_decode(
				$body,
				true
			);

		if (
			JSON_ERROR_NONE !==
				json_last_error() ||
			! is_array(
				$json
			)
		) {

			return new WP_Error(
				'lsl254_invalid_json',
				sprintf(
					'JSON %s tidak valid.',
					$provider
				)
			);
		}

		return $json;
	}

	/**
	 * =========================================================
	 * FOOTBALL-DATA.ORG
	 * =========================================================
	 */
	private function request_football_data() {

		$settings =
			$this->get_settings();

		$key =
			trim(
				$settings['football_data_key']
			);

		if ( '' === $key ) {

			return new WP_Error(
				'lsl254_no_key',
				'API key football-data.org belum diisi.'
			);
		}

		$range =
			$this->football_data_date_range();

		$url =
			add_query_arg(
				array(
					'dateFrom' =>
						$range['from'],

					'dateTo' =>
						$range['to'],
				),
				'https://api.football-data.org/v4/matches'
			);

		return $this->remote_json(
			$url,
			'football-data.org',
			array(
				'X-Auth-Token' =>
					$key,
			)
		);
	}

	private function get_football_data_matches() {

		$settings =
			$this->get_settings();

		if (
			empty(
				$settings['football_data_key']
			)
		) {
			return array();
		}

		$range =
			$this->football_data_date_range();

		$cache_key =
			'lsl254_fd_' .
			md5(
				$range['from'] .
					'|' .
					$range['to']
			);

		$cached =
			get_transient(
				$cache_key
			);

		if (
			false !== $cached &&
			is_array(
				$cached
			)
		) {
			return $cached;
		}

		$json =
			$this->request_football_data();

		if (
			is_wp_error(
				$json
			)
		) {
			return $json;
		}

		if (
			empty(
				$json['matches']
			) ||
			! is_array(
				$json['matches']
			)
		) {
			return array();
		}

		$output =
			array();

		foreach (
			$json['matches']
			as $match
		) {

			if (
				! is_array(
					$match
				)
			) {
				continue;
			}

			$home_data =
				isset(
					$match['homeTeam']
				) &&
				is_array(
					$match['homeTeam']
				)
					? $match['homeTeam']
					: array();

			$away_data =
				isset(
					$match['awayTeam']
				) &&
				is_array(
					$match['awayTeam']
				)
					? $match['awayTeam']
					: array();

			$home =
				$this->fd_team_name(
					$home_data
				);

			$away =
				$this->fd_team_name(
					$away_data
				);

			if (
				! $home ||
				! $away
			) {
				continue;
			}

			$timestamp =
				! empty(
					$match['utcDate']
				)
					? $this->parse_timestamp(
						$match['utcDate']
					)
					: 0;

			$status_raw =
				isset(
					$match['status']
				)
					? strtoupper(
						sanitize_text_field(
							(string) $match['status']
						)
					)
					: '';

			$state =
				$this->fd_state(
					$status_raw
				);

			if (
				'live' !==
					$state &&
				(
					! $timestamp ||
					! $this->inside_matchday(
						$timestamp
					)
				)
			) {
				continue;
			}

			$output[] = array(
				'home' =>
					$home,

				'away' =>
					$away,

				'home_logo' =>
					isset(
						$home_data['crest']
					)
						? esc_url_raw(
							(string) $home_data['crest']
						)
						: '',

				'away_logo' =>
					isset(
						$away_data['crest']
					)
						? esc_url_raw(
							(string) $away_data['crest']
						)
						: '',

				'score' =>
					$this->fd_score(
						$match
					),

				'status' =>
					$this->fd_status(
						$status_raw,
						$match
					),

				'state' =>
					$state,

				'start_ts' =>
					$timestamp,

				'kickoff_wib' =>
					$timestamp
						? wp_date(
							'H:i',
							$timestamp,
							$this->timezone()
						)
						: '',

				'next_morning' =>
					$timestamp
						? $this->next_morning(
							$timestamp
						)
						: false,

				'competition' =>
					isset(
						$match['competition']['name']
					)
						? sanitize_text_field(
							(string) $match['competition']['name']
						)
						: '',

				'region' =>
					isset(
						$match['area']['name']
					)
						? sanitize_text_field(
							(string) $match['area']['name']
						)
						: '',

				'round' =>
					isset( $match['matchday'] ) && is_scalar( $match['matchday'] )
						? 'Round ' . absint( $match['matchday'] )
						: '',

				'provider' =>
					'football-data.org',

				'priority' =>
					80,
			);
		}

		set_transient(
			$cache_key,
			$output,
			self::SCHEDULE_CACHE_TTL
		);

		return $output;
	}

	private function fd_team_name( $team ) {

		foreach (
			array(
				'name',
				'shortName',
				'tla',
			)
			as $field
		) {

			if (
				isset(
					$team[ $field ]
				) &&
				is_scalar(
					$team[ $field ]
				)
			) {

				return sanitize_text_field(
					(string) $team[ $field ]
				);
			}
		}

		return '';
	}

	private function fd_state( $status ) {

		switch ( $status ) {

			case 'LIVE':
			case 'IN_PLAY':
			case 'PAUSED':
				return 'live';

			case 'FINISHED':
				return 'final';

			case 'SCHEDULED':
			case 'TIMED':
				return 'upcoming';

			default:
				return 'other';
		}
	}

	private function fd_status(
		$status,
		$match
	) {

		switch ( $status ) {

			case 'LIVE':
			case 'IN_PLAY':

				if (
					isset(
						$match['minute']
					) &&
					is_numeric(
						$match['minute']
					)
				) {

					return absint(
						$match['minute']
					) . "'";
				}

				return 'Live';

			case 'PAUSED':
				return 'Turun Minum';

			case 'FINISHED':
				return 'Final';

			case 'SCHEDULED':
			case 'TIMED':
				return 'Belum Mulai';

			case 'POSTPONED':
				return 'Ditunda';

			case 'SUSPENDED':
				return 'Dihentikan';

			case 'CANCELLED':
				return 'Dibatalkan';
		}

		return $status
			? $status
			: '-';
	}

	private function fd_score( $match ) {

		if (
			empty(
				$match['score']
			) ||
			! is_array(
				$match['score']
			)
		) {
			return '- - -';
		}

		foreach (
			array(
				'fullTime',
				'regularTime',
				'halfTime',
			)
			as $set
		) {

			if (
				empty(
					$match['score'][ $set ]
				) ||
				! is_array(
					$match['score'][ $set ]
				)
			) {
				continue;
			}

			$home =
				array_key_exists(
					'home',
					$match['score'][ $set ]
				)
					? $match['score'][ $set ]['home']
					: null;

			$away =
				array_key_exists(
					'away',
					$match['score'][ $set ]
				)
					? $match['score'][ $set ]['away']
					: null;

			if (
				null !== $home ||
				null !== $away
			) {

				return $this->safe_score(
					$home
				) .
					' - ' .
					$this->safe_score(
						$away
					);
			}
		}

		return '- - -';
	}

	/**
	 * =========================================================
	 * SPORTING EVENTS
	 * =========================================================
	 */
	private function get_sporting_events( $sport ) {

		if (
			! isset(
				self::$datasets[ $sport ]
			)
		) {
			return array();
		}

		$dataset =
			self::$datasets[ $sport ];

		$cache_key =
			'lsl254_dataset_' .
			md5(
				$dataset .
					'|' .
					$this->today_key()
			);

		$cached =
			get_transient(
				$cache_key
			);

		if (
			false !== $cached &&
			is_array(
				$cached
			)
		) {
			return $cached;
		}

		$url =
			sprintf(
				'https://sporting-events.org/data/%s.json',
				rawurlencode(
					$dataset
				)
			);

		$json =
			$this->remote_json(
				$url,
				'Sporting Events'
			);

		if (
			is_wp_error(
				$json
			)
		) {
			return $json;
		}

		if (
			empty(
				$json['events']
			) ||
			! is_array(
				$json['events']
			)
		) {
			return array();
		}

		$output =
			array();

		foreach (
			$json['events']
			as $event
		) {

			if (
				! is_array(
					$event
				)
			) {
				continue;
			}

			$teams =
				$this->sporting_event_teams(
					$event
				);

			if (
				empty(
					$teams['home']
				) ||
				empty(
					$teams['away']
				)
			) {
				continue;
			}

			$date =
				isset(
					$event['date_utc']
				)
					? sanitize_text_field(
						(string) $event['date_utc']
					)
					: '';

			$time =
				isset(
					$event['time_utc']
				)
					? sanitize_text_field(
						(string) $event['time_utc']
					)
					: '';

			if (
				! $date ||
				! $time
			) {
				continue;
			}

			$timestamp =
				$this->utc_datetime_timestamp(
					$date,
					$time
				);

			if (
				! $timestamp ||
				! $this->inside_matchday(
					$timestamp
				)
			) {
				continue;
			}

			$status_raw =
				isset(
					$event['status']
				)
					? strtolower(
						sanitize_text_field(
							(string) $event['status']
						)
					)
					: 'scheduled';

			$state =
				'upcoming';

			if (
				in_array(
					$status_raw,
					array(
						'completed',
						'finished',
						'final',
					),
					true
				)
			) {

				$state =
					'final';

			} elseif (
				in_array(
					$status_raw,
					array(
						'cancelled',
						'canceled',
						'postponed',
					),
					true
				)
			) {

				$state =
					'other';
			}

			$output[] = array(
				'home' =>
					$teams['home'],

				'away' =>
					$teams['away'],

				'home_logo' =>
					'',

				'away_logo' =>
					'',

				'score' =>
					'- - -',

				'status' =>
					$this->schedule_status(
						$status_raw
					),

				'state' =>
					$state,

				'start_ts' =>
					$timestamp,

				'kickoff_wib' =>
					wp_date(
						'H:i',
						$timestamp,
						$this->timezone()
					),

				'next_morning' =>
					$this->next_morning(
						$timestamp
					),

				'competition' =>
					$this->extract_competition(
						$event
					),

				'region' =>
					isset(
						$event['country']
					)
						? sanitize_text_field(
							(string) $event['country']
						)
						: $this->extract_region( $event ),

				'round' =>
					$this->extract_round( $event ),

				'provider' =>
					'Sporting Events',

				'priority' =>
					30,
			);
		}

		set_transient(
			$cache_key,
			$output,
			self::SCHEDULE_CACHE_TTL
		);

		return $output;
	}

	private function sporting_event_teams( $event ) {

		$home =
			isset(
				$event['home_team']
			)
				? sanitize_text_field(
					(string) $event['home_team']
				)
				: '';

		$away =
			isset(
				$event['away_team']
			)
				? sanitize_text_field(
					(string) $event['away_team']
				)
				: '';

		if (
			$home &&
			$away
		) {

			return array(
				'home' =>
					$home,

				'away' =>
					$away,
			);
		}

		$fixture =
			isset(
				$event['fixture']
			)
				? sanitize_text_field(
					(string) $event['fixture']
				)
				: '';

		if ( $fixture ) {

			$parts =
				preg_split(
					'/\s+vs\.?\s+/i',
					$fixture,
					2
				);

			if (
				is_array(
					$parts
				) &&
				2 ===
					count(
						$parts
					)
			) {

				return array(
					'home' =>
						sanitize_text_field(
							trim(
								$parts[0]
							)
						),

					'away' =>
						sanitize_text_field(
							trim(
								$parts[1]
							)
						),
				);
			}
		}

		return array(
			'home' => '',
			'away' => '',
		);
	}

	private function schedule_status( $status ) {

		switch ( $status ) {

			case 'completed':
			case 'finished':
			case 'final':
				return 'Final';

			case 'postponed':
				return 'Ditunda';

			case 'cancelled':
			case 'canceled':
				return 'Dibatalkan';

			default:
				return 'Belum Mulai';
		}
	}

	/**
	 * =========================================================
	 * SPORTScore
	 * =========================================================
	 */
	private function get_sportscore( $sport ) {

		if (
			! in_array(
				$sport,
				array(
					'football',
					'basketball',
					'tennis',
					'cricket',
				),
				true
			)
		) {
			return array();
		}

		$host =
			wp_parse_url(
				home_url( '/' ),
				PHP_URL_HOST
			);

		$url =
			add_query_arg(
				array(
					'sport' =>
						$sport,

					'limit' =>
						50,

					'src' =>
						sanitize_text_field(
							(string) $host
						),
				),
				'https://sportscore.com/api/widget/matches/'
			);

		$json =
			$this->remote_json(
				$url,
				'SportScore'
			);

		if (
			is_wp_error(
				$json
			)
		) {
			return $json;
		}

		if (
			empty(
				$json['matches']
			) ||
			! is_array(
				$json['matches']
			)
		) {
			return array();
		}

		$output =
			array();

		foreach (
			$json['matches']
			as $match
		) {

			if (
				! is_array(
					$match
				)
			) {
				continue;
			}

			$home =
				$this->extract_team(
					$match,
					array(
						'home',
						'home_team',
						'homeTeam',
					)
				);

			$away =
				$this->extract_team(
					$match,
					array(
						'away',
						'away_team',
						'awayTeam',
					)
				);

			if (
				! $home ||
				! $away
			) {
				continue;
			}

			$timestamp =
				$this->extract_timestamp(
					$match
				);

			$status_raw =
				$this->first_scalar(
					$match,
					array(
						'status',
						'match_status',
						'matchStatus',
						'state',
						'period',
					)
				);

			$state =
				$this->classify_status(
					$status_raw,
					$timestamp
				);

			$status_text_raw =
				$this->first_scalar(
					$match,
					array(
						'status_text',
						'statusText',
						'display_status',
						'displayStatus',
					)
				);

			$minute =
				$this->extract_live_minute(
					$match,
					$state,
					$status_text_raw
				);

			if (
				'live' !==
					$state &&
				(
					! $timestamp ||
					! $this->inside_matchday(
						$timestamp
					)
				)
			) {
				continue;
			}

			$output[] = array(
				'home' =>
					$home,

				'away' =>
					$away,

				'home_logo' =>
					$this->extract_logo(
						$match,
						'home'
					),

				'away_logo' =>
					$this->extract_logo(
						$match,
						'away'
					),

				'score' =>
					$this->extract_score(
						$match
					),

				'status' =>
					$this->normalize_status(
						$status_raw,
						$state
					),

				'minute' =>
					$minute,

				'state' =>
					$state,

				'start_ts' =>
					$timestamp,

				'kickoff_wib' =>
					$timestamp
						? wp_date(
							'H:i',
							$timestamp,
							$this->timezone()
						)
						: '',

				'next_morning' =>
					$timestamp
						? $this->next_morning(
							$timestamp
						)
						: false,

				'competition' =>
					$this->extract_competition(
						$match
					),

				'competition_logo' =>
					$this->extract_competition_logo( $match ),

				'region' =>
					$this->extract_region( $match ),

				'region_logo' =>
					$this->extract_region_logo( $match ),

				'region_code' =>
					$this->extract_region_code( $match ),

				'round' =>
					$this->extract_round( $match ),

				'sportscore_id' =>
					sanitize_text_field(
						(string) $this->first_scalar(
							$match,
							array( 'id', 'match_id', 'matchId', 'event_id', 'eventId' )
						)
					),

				'sportscore_slug' =>
					sanitize_title(
						(string) $this->first_scalar(
							$match,
							array( 'slug', 'match_slug', 'matchSlug' )
						)
					),

				'provider' =>
					'SportScore',

				'priority' =>
					100,
			);
		}

		return $output;
	}


	/**
	 * =========================================================
	 * SPORTSCORE LIVE PAGE MINUTE SYNC
	 * =========================================================
	 * SportScore's public live page exposes the same live minute shown
	 * in their reference UI (47, 49, 90+, HT, etc.). The compact JSON
	 * endpoint does not always expose that minute, so football live
	 * matches are enriched from the public live page by matching teams.
	 */
	private function enrich_sportscore_live_minutes( $matches ) {

		if ( empty( $matches ) || ! is_array( $matches ) ) {
			return $matches;
		}

		$has_live = false;
		foreach ( $matches as $match ) {
			if ( is_array( $match ) && isset( $match['state'] ) && 'live' === $match['state'] ) {
				$has_live = true;
				break;
			}
		}

		if ( ! $has_live ) {
			return $matches;
		}

		$live_source = $this->get_sportscore_live_page_structured();
		$live_lines = ( ! is_wp_error( $live_source ) && ! empty( $live_source['lines'] ) && is_array( $live_source['lines'] ) )
			? $live_source['lines']
			: array();
		$live_text = ( ! is_wp_error( $live_source ) && isset( $live_source['plain'] ) )
			? (string) $live_source['plain']
			: '';

		foreach ( $matches as &$match ) {

			if (
				! is_array( $match ) ||
				empty( $match['home'] ) ||
				empty( $match['away'] ) ||
				empty( $match['state'] ) ||
				'live' !== $match['state']
			) {
				continue;
			}

			$minute = '';
			$source = '';
			$synced_at = 0;

			/* 1) Halaman LIVE SportScore -- sama dengan acuan visual user. */
			if ( ! empty( $live_lines ) ) {
				$minute = $this->find_sportscore_live_minute_lines(
					$live_lines,
					(string) $match['home'],
					(string) $match['away'],
					isset( $match['competition'] ) ? (string) $match['competition'] : ''
				);
				if ( '' !== $minute ) {
					$source = 'reference';
				}
			}

			if ( '' === $minute && '' !== $live_text ) {
				$minute = $this->find_sportscore_live_minute(
					$live_text,
					(string) $match['home'],
					(string) $match['away']
				);
				if ( '' !== $minute ) {
					$source = 'reference-plain';
				}
			}

			/* 2) Tracker JSON resmi. */
			if ( '' === $minute && ! empty( $match['sportscore_id'] ) ) {
				$minute = $this->get_sportscore_tracker_minute( (string) $match['sportscore_id'] );
				if ( '' !== $minute ) {
					$source = 'tracker';
				}
			}

			/* 3) Detail JSON resmi. */
			if ( '' === $minute && ! empty( $match['sportscore_slug'] ) ) {
				$minute = $this->get_sportscore_detail_minute( (string) $match['sportscore_slug'] );
				if ( '' !== $minute ) {
					$source = 'detail';
				}
			}

			/* 4) Detail JSON dengan kandidat slug bila compact endpoint tidak memberi slug. */
			if ( '' === $minute ) {
				$slug_candidates = array_unique(
					array_filter(
						array(
							sanitize_title( (string) $match['home'] . '-vs-' . (string) $match['away'] ),
							sanitize_title( (string) $match['away'] . '-vs-' . (string) $match['home'] ),
						)
					)
				);
				foreach ( $slug_candidates as $candidate_slug ) {
					if ( ! empty( $match['sportscore_slug'] ) && $candidate_slug === (string) $match['sportscore_slug'] ) {
						continue;
					}
					$minute = $this->get_sportscore_detail_minute( $candidate_slug );
					if ( '' !== $minute ) {
						$source = 'detail-guessed';
						break;
					}
				}
			}

			/* 5) Field minute dari endpoint matches. */
			if ( '' === $minute && ! empty( $match['minute'] ) ) {
				$minute = $this->normalize_sportscore_minute_value( $match['minute'] );
				if ( '' !== $minute ) {
					$source = 'matches';
				}
			}

			$last_key = $this->sportscore_last_minute_cache_key( $match );

			if ( '' !== $minute ) {
				$synced_at = time();
				set_transient(
					$last_key,
					array(
						'minute'    => $minute,
						'synced_at' => $synced_at,
						'source'    => $source,
					),
					8 * MINUTE_IN_SECONDS
				);
			} else {
				/*
				 * Jangan menghilangkan menit valid hanya karena satu request gagal.
				 * Ambil snapshot resmi terakhir untuk pertandingan yang sama.
				 */
				$last = get_transient( $last_key );
				if (
					is_array( $last ) &&
					! empty( $last['minute'] ) &&
					! empty( $last['synced_at'] ) &&
					( time() - absint( $last['synced_at'] ) ) <= ( 8 * MINUTE_IN_SECONDS )
				) {
					$minute    = $this->normalize_sportscore_minute_value( $last['minute'] );
					$synced_at = absint( $last['synced_at'] );
					$source    = 'last-valid';
				}
			}

			$match['minute'] = $minute;
			$match['minute_synced_at'] = $synced_at;
			$match['minute_source'] = $source;
		}

		unset( $match );

		return $matches;
	}

	private function sportscore_last_minute_cache_key( $match ) {

		$id = '';
		if ( ! empty( $match['sportscore_id'] ) ) {
			$id = 'id:' . sanitize_text_field( (string) $match['sportscore_id'] );
		} else {
			$id = strtolower(
				trim( (string) ( isset( $match['home'] ) ? $match['home'] : '' ) ) . '|' .
				trim( (string) ( isset( $match['away'] ) ? $match['away'] : '' ) ) . '|' .
				$this->today_key()
			);
		}

		return 'lsl254_ss_last_min_' . md5( $id );
	}

	private function get_sportscore_live_page_text() {

		$source = $this->get_sportscore_live_page_structured();
		if ( is_wp_error( $source ) ) {
			return $source;
		}

		return isset( $source['plain'] )
			? (string) $source['plain']
			: '';
	}

private function get_sportscore_live_page_structured() {

	/*
	 * Gunakan URL stabil agar Cloudflare edge cache SportScore bekerja.
	 * Cache-buster/no-cache justru membuat origin lebih mudah menolak request.
	 */
	$cache_key = 'lsl254_sportscore_live_structured_v3';
	$cached = get_transient( $cache_key );

	if (
		false !== $cached &&
		is_array( $cached ) &&
		! empty( $cached['lines'] )
	) {
		return $cached;
	}

	$urls = array(
		'https://sportscore.com/football/?filter=live',
		'https://sportscore.com/id/football/?filter=live',
		'https://sportscore.com/football/',
		'https://sportscore.com/id/football/',
	);

	$last_error = null;

	foreach ( $urls as $url ) {
		$response = wp_safe_remote_get(
			$url,
			array(
				'timeout'     => 15,
				'redirection' => 4,
				'sslverify'   => true,
				'headers'     => array(
					'Accept'          => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language' => 'en-US,en;q=0.9,id;q=0.8',
					'Referer'         => 'https://sportscore.com/',
					'User-Agent'      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Safari/537.36',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			$last_error = $response;
			continue;
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( $code < 200 || $code >= 300 ) {
			$last_error = new WP_Error(
				'lsl254_sportscore_live_http',
				'SportScore live page HTTP ' . absint( $code ) . '.'
			);
			continue;
		}

		$html = (string) wp_remote_retrieve_body( $response );
		if ( strlen( trim( $html ) ) < 500 ) {
			$last_error = new WP_Error(
				'lsl254_sportscore_live_empty',
				'SportScore live page kosong atau terlalu pendek.'
			);
			continue;
		}

		$parsed = $this->sportscore_html_to_live_lines( $html );
		if ( empty( $parsed['lines'] ) || count( $parsed['lines'] ) < 20 ) {
			continue;
		}

		$plain_lower = strtolower( (string) $parsed['plain'] );
		if (
			false === strpos( $plain_lower, 'football' ) &&
			false === strpos( $plain_lower, 'sepak bola' ) &&
			false === strpos( $plain_lower, 'live football' ) &&
			false === strpos( $plain_lower, 'laga sepak bola' )
		) {
			continue;
		}

		/* 25 detik: cukup fresh, tapi tidak membombardir SportScore per visitor. */
		set_transient( $cache_key, $parsed, 25 );
		return $parsed;
	}

	return $last_error instanceof WP_Error
		? $last_error
		: new WP_Error(
			'lsl254_sportscore_live_unavailable',
			'SportScore live page tidak dapat dibaca.'
		);
}

private function sportscore_html_to_live_lines( $html ) {

	$html = (string) $html;
	$lines = array();

	/*
	 * DOM text-node parser lebih tahan terhadap perubahan class/wrapper.
	 * Kita hanya menjaga urutan teks yang benar-benar terlihat.
	 */
	if ( class_exists( 'DOMDocument' ) && class_exists( 'DOMXPath' ) ) {
		$previous = libxml_use_internal_errors( true );
		$dom = new DOMDocument();
		$loaded = $dom->loadHTML(
			'<?xml encoding="utf-8" ?>' . $html,
			LIBXML_NOWARNING | LIBXML_NOERROR | LIBXML_NONET
		);

		if ( $loaded ) {
			$xpath = new DOMXPath( $dom );
			$nodes = $xpath->query(
				'//body//text()[normalize-space(.) != "" and not(ancestor::script) and not(ancestor::style) and not(ancestor::noscript) and not(ancestor::svg)]'
			);
			if ( $nodes ) {
				foreach ( $nodes as $node ) {
					$line = html_entity_decode( trim( (string) $node->nodeValue ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
					$line = preg_replace( '/\s+/u', ' ', $line );
					if ( '' === $line || preg_match( '/^[*•·|\-]{2,}$/u', $line ) ) {
						continue;
					}
					$lines[] = $line;
				}
			}
		}
		libxml_clear_errors();
		libxml_use_internal_errors( $previous );
	}

	/* Fallback untuk host tanpa ext-dom. */
	if ( count( $lines ) < 20 ) {
		$clean = preg_replace( '#<(script|style|noscript|svg)\b[^>]*>.*?</\1>#is', ' ', $html );
		$clean = preg_replace(
			'#</?(?:div|li|tr|td|th|a|span|p|section|article|header|footer|h[1-6]|button|label|strong|small|time)[^>]*>#i',
			"\n",
			$clean
		);
		$clean = preg_replace( '#<br\s*/?>#i', "\n", $clean );
		$raw = wp_strip_all_tags( $clean, false );
		$raw = html_entity_decode( $raw, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$raw = str_replace( array( "\r\n", "\r" ), "\n", $raw );
		$raw_lines = preg_split( '/\n+/u', $raw );
		$lines = array();
		foreach ( $raw_lines as $line ) {
			$line = preg_replace( '/\s+/u', ' ', trim( (string) $line ) );
			if ( '' === $line || preg_match( '/^[*•·|\-]{2,}$/u', $line ) ) {
				continue;
			}
			$lines[] = $line;
		}
	}

	/* Buang duplikat berturut-turut akibat nested anchors/spans. */
	$compact = array();
	$prev = null;
	foreach ( $lines as $line ) {
		if ( null !== $prev && $line === $prev ) {
			continue;
		}
		$compact[] = $line;
		$prev = $line;
	}

	return array(
		'lines' => array_values( $compact ),
		'plain' => implode( "\n", $compact ),
	);
}

	private function normalize_sportscore_team_name( $name ) {

		$name = remove_accents( (string) $name );
		$name = strtolower( $name );
		$name = str_replace( '&', ' and ', $name );
		$name = preg_replace( '/[^a-z0-9]+/u', ' ', $name );
		$name = preg_replace( '/\\s+/u', ' ', trim( $name ) );

		return $name;
	}

private function sportscore_team_similarity( $a, $b ) {

	$a = $this->normalize_sportscore_team_name( $a );
	$b = $this->normalize_sportscore_team_name( $b );

	if ( '' === $a || '' === $b ) {
		return 0.0;
	}
	if ( $a === $b ) {
		return 1.0;
	}
	if (
		min( strlen( $a ), strlen( $b ) ) >= 6 &&
		( false !== strpos( $a, $b ) || false !== strpos( $b, $a ) )
	) {
		return 0.96;
	}

	$ta = array_values( array_filter( explode( ' ', $a ) ) );
	$tb = array_values( array_filter( explode( ' ', $b ) ) );
	$intersection = count( array_intersect( $ta, $tb ) );
	$union = count( array_unique( array_merge( $ta, $tb ) ) );
	$jaccard = $union > 0 ? ( $intersection / $union ) : 0.0;

	$max_len = max( strlen( $a ), strlen( $b ) );
	$lev = $max_len > 0 ? 1.0 - ( min( levenshtein( $a, $b ), $max_len ) / $max_len ) : 0.0;

	$percent = 0.0;
	similar_text( $a, $b, $percent );
	$similar = $percent / 100.0;

	return max( $jaccard, $lev, $similar );
}

private function sportscore_team_line_matches( $line, $team ) {
	return $this->sportscore_team_similarity( $line, $team ) >= 0.76;
}

	private function sportscore_line_is_time( $line ) {

		return (bool) preg_match(
			'/^\\d{1,2}:\\d{2}(?:\\s*(?:AM|PM))?$/i',
			trim( (string) $line )
		);
	}

	private function sportscore_line_to_minute( $line ) {

		$value = strtoupper( trim( (string) $line ) );
		$value = str_replace( array( '’', '′' ), "'", $value );
		$value = rtrim( $value, "'" );

		if ( 'HT' === $value ) {
			return 'HT';
		}

		if ( preg_match( '/^(\\d{1,3})(?:\\+(\\d{1,2}))?\\+?$/', $value, $m ) ) {
			$base = absint( $m[1] );
			if ( $base < 1 || $base > 130 ) {
				return '';
			}

			if ( isset( $m[2] ) && '' !== $m[2] ) {
				return $base . '+' . absint( $m[2] ) . "'";
			}

			if ( false !== strpos( $value, '+' ) ) {
				return $base . "+'";
			}

			return $base . "'";
		}

		return '';
	}

private function find_sportscore_live_minute_lines( $lines, $home, $away, $competition = '' ) {

	if ( empty( $lines ) || '' === $home || '' === $away ) {
		return '';
	}

	$count = count( $lines );
	$best = array( 'score' => 0.0, 'minute' => '' );
	$pairs = array(
		array( $home, $away ),
		array( $away, $home ),
	);

	foreach ( $pairs as $pair ) {
		for ( $i = 0; $i < $count; $i++ ) {
			$home_score = $this->sportscore_team_similarity( $lines[ $i ], $pair[0] );
			if ( $home_score < 0.76 ) {
				continue;
			}

			for ( $j = $i + 1; $j <= min( $count - 1, $i + 22 ); $j++ ) {
				$away_score = $this->sportscore_team_similarity( $lines[ $j ], $pair[1] );
				if ( $away_score < 0.76 ) {
					continue;
				}

				$minute = '';
				$minute_index = -1;
				$time_index = -1;

				/* SportScore reference: time -> minute -> ... -> home -> away. */
				for ( $k = $i - 1; $k >= max( 0, $i - 18 ); $k-- ) {
					$candidate = $this->sportscore_line_to_minute( $lines[ $k ] );
					if ( '' === $candidate ) {
						continue;
					}
					for ( $t = $k - 1; $t >= max( 0, $k - 7 ); $t-- ) {
						if ( $this->sportscore_line_is_time( $lines[ $t ] ) ) {
							$minute = $candidate;
							$minute_index = $k;
							$time_index = $t;
							break 2;
						}
					}
				}

				if ( '' === $minute ) {
					continue;
				}

				$score = ( $home_score + $away_score ) * 4.0;
				$score += max( 0.0, 2.0 - ( ( $j - $i ) / 12.0 ) );
				$score += max( 0.0, 1.5 - ( ( $i - $minute_index ) / 12.0 ) );

				/* Kompetisi dekat baris waktu mengurangi risiko salah pair nama mirip. */
				if ( '' !== $competition && $time_index >= 0 ) {
					for ( $c = $time_index - 1; $c >= max( 0, $time_index - 20 ); $c-- ) {
						$comp_similarity = $this->sportscore_team_similarity( $lines[ $c ], $competition );
						if ( $comp_similarity >= 0.65 ) {
							$score += 2.0 * $comp_similarity;
							break;
						}
					}
				}

				if ( $score > $best['score'] ) {
					$best = array( 'score' => $score, 'minute' => $minute );
				}
			}
		}
	}

	return $best['score'] >= 6.0 ? $best['minute'] : '';
}

	private function find_sportscore_live_minute( $text, $home, $away ) {

		if ( '' === $text || '' === $home || '' === $away ) {
			return '';
		}

		/*
		 * Abaikan featured/header di atas daftar utama. Nama tim yang sama bisa
		 * muncul di featured card dan membuat token angka salah terbaca sebagai menit.
		 */
		$markers = array(
			'Live football matches',
			'LIVE FOOTBALL MATCHES',
			'Live matches',
		);

		foreach ( $markers as $marker ) {
			$marker_pos = stripos( $text, $marker );
			if ( false !== $marker_pos ) {
				$text = substr( $text, $marker_pos );
				break;
			}
		}

		$pairs = array(
			array( $home, $away ),
			array( $away, $home ),
		);

		foreach ( $pairs as $pair ) {

			$first  = preg_quote( trim( (string) $pair[0] ), '/' );
			$second = preg_quote( trim( (string) $pair[1] ), '/' );

			if ( '' === $first || '' === $second ) {
				continue;
			}

			if ( ! preg_match( '/' . $first . '/iu', $text, $m1, PREG_OFFSET_CAPTURE ) ) {
				continue;
			}

			$first_pos = (int) $m1[0][1];
			$after = substr( $text, $first_pos + strlen( $m1[0][0] ), 700 );

			if ( ! preg_match( '/' . $second . '/iu', $after ) ) {
				// Cari occurrence berikutnya jika nama pertama muncul di tempat lain.
				$offset = $first_pos + strlen( $m1[0][0] );
				$found_pair = false;

				for ( $attempt = 0; $attempt < 6; $attempt++ ) {
					$tail = substr( $text, $offset );
					if ( ! preg_match( '/' . $first . '/iu', $tail, $next, PREG_OFFSET_CAPTURE ) ) {
						break;
					}
					$first_pos = $offset + (int) $next[0][1];
					$after = substr( $text, $first_pos + strlen( $next[0][0] ), 700 );
					if ( preg_match( '/' . $second . '/iu', $after ) ) {
						$found_pair = true;
						break;
					}
					$offset = $first_pos + strlen( $next[0][0] );
				}

				if ( ! $found_pair ) {
					continue;
				}
			}

			/**
			 * Struktur SportScore live secara tekstual:
			 * [kickoff] [minute/HT] ... [home] [away] ... [score]
			 * Ambil token menit TERAKHIR sebelum nama home.
			 */
			$before_start = max( 0, $first_pos - 220 );
			$before = substr( $text, $before_start, $first_pos - $before_start );

			if (
				preg_match_all(
					'/(?:^|\s)(HT|\d{1,3}\+\d{1,2}|\d{1,3}\+|\d{1,3})(?=\s|$)/iu',
					$before,
					$tokens
				) &&
				! empty( $tokens[1] )
			) {
				$value = strtoupper( (string) end( $tokens[1] ) );

				if ( 'HT' === $value ) {
					return 'HT';
				}

				// Abaikan token yang jelas merupakan jam/round jika salah tangkap.
				$numeric = (int) preg_replace( '/\D.*/', '', $value );
				if ( $numeric >= 1 && $numeric <= 130 ) {
					return $value . "'";
				}
			}
		}

		return '';
	}


	private function get_sportscore_tracker_minute( $match_id ) {

		$match_id = preg_replace( '/[^0-9]/', '', (string) $match_id );
		if ( '' === $match_id ) {
			return '';
		}

		$cache_key = 'lsl254_ss_tracker_min_' . md5( $match_id );
		$cached = get_transient( $cache_key );
		if ( false !== $cached ) {
			return '__none__' === $cached ? '' : (string) $cached;
		}

		$host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		$url = add_query_arg(
			array(
				'sport' => 'football',
				'id'    => $match_id,
				'src'   => sanitize_text_field( (string) $host ),
			),
			'https://sportscore.com/api/widget/tracker/'
		);

		$json = $this->remote_json(
			$url,
			'SportScore Tracker',
			array(
				'Cache-Control' => 'no-cache',
				'Pragma'        => 'no-cache',
			)
		);

		$minute = is_wp_error( $json ) ? '' : $this->find_live_minute_recursive( $json );
		set_transient( $cache_key, '' !== $minute ? $minute : '__none__', 12 );
		return $minute;
	}

	private function get_sportscore_detail_minute( $slug ) {

		$slug = sanitize_title( (string) $slug );
		if ( '' === $slug ) {
			return '';
		}

		$cache_key = 'lsl254_ss_detail_min_' . md5( $slug );
		$cached = get_transient( $cache_key );
		if ( false !== $cached ) {
			return '__none__' === $cached ? '' : (string) $cached;
		}

		$host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		$url = add_query_arg(
			array(
				'sport' => 'football',
				'slug'  => $slug,
				'src'   => sanitize_text_field( (string) $host ),
			),
			'https://sportscore.com/api/widget/match/'
		);

		$json = $this->remote_json(
			$url,
			'SportScore Match Detail',
			array(
				'Cache-Control' => 'no-cache',
				'Pragma'        => 'no-cache',
			)
		);

		$minute = is_wp_error( $json ) ? '' : $this->find_live_minute_recursive( $json );
		set_transient( $cache_key, '' !== $minute ? $minute : '__none__', 12 );
		return $minute;
	}

	private function find_live_minute_recursive( $value, $depth = 0 ) {

		if ( $depth > 8 || ! is_array( $value ) ) {
			return '';
		}

		$priority_keys = array(
			'minute', 'minutes', 'match_minute', 'matchMinute', 'elapsed',
			'elapsed_time', 'elapsedTime', 'live_minute', 'liveMinute',
			'status_text', 'statusText', 'display_status', 'displayStatus',
			'clock', 'match_clock', 'matchClock', 'game_clock', 'gameClock'
		);

		foreach ( $priority_keys as $key ) {
			if ( ! array_key_exists( $key, $value ) ) {
				continue;
			}
			if ( is_scalar( $value[ $key ] ) ) {
				$minute = $this->normalize_sportscore_minute_value( $value[ $key ] );
				if ( '' !== $minute ) {
					return $minute;
				}
			} elseif ( is_array( $value[ $key ] ) ) {
				$minute = $this->find_live_minute_recursive( $value[ $key ], $depth + 1 );
				if ( '' !== $minute ) {
					return $minute;
				}
			}
		}

		foreach ( $value as $child ) {
			if ( is_array( $child ) ) {
				$minute = $this->find_live_minute_recursive( $child, $depth + 1 );
				if ( '' !== $minute ) {
					return $minute;
				}
			}
		}

		return '';
	}

	private function normalize_sportscore_minute_value( $value ) {

		if ( is_int( $value ) || is_float( $value ) ) {
			$number = (int) $value;
			return ( $number >= 1 && $number <= 130 ) ? $number . "'" : '';
		}

		if ( ! is_scalar( $value ) ) {
			return '';
		}

		$text = strtoupper( trim( wp_strip_all_tags( (string) $value ) ) );
		if ( '' === $text ) {
			return '';
		}

		if ( in_array( $text, array( 'HT', 'HALF TIME', 'HALFTIME' ), true ) ) {
			return 'HT';
		}

		if ( preg_match( '/^(\\d{1,3})(?:\\+(\\d{1,2}))?\\+?\\s*[\'’]?$/u', $text, $m ) ) {
			$base = (int) $m[1];
			if ( $base < 1 || $base > 130 ) {
				return '';
			}
			if ( isset( $m[2] ) && '' !== $m[2] ) {
				return $base . '+' . (int) $m[2] . "'";
			}
			if ( false !== strpos( $text, '+' ) ) {
				return $base . "+'";
			}
			return $base . "'";
		}

		return '';
	}

	private function estimate_live_minute( $match ) {

		if ( empty( $match['start_ts'] ) || ! is_numeric( $match['start_ts'] ) ) {
			return '';
		}

		$now = time();
		$elapsed = (int) floor( ( $now - (int) $match['start_ts'] ) / 60 );

		if ( $elapsed < 1 ) {
			return '';
		}

		// Jangan menghasilkan angka absurd bila provider terlambat mengubah status.
		if ( $elapsed > 125 ) {
			return '';
		}

		// Koreksi jeda halftime 15 menit untuk estimasi second half.
		if ( $elapsed > 45 ) {
			$elapsed = max( 45, $elapsed - 15 );
		}

		$elapsed = min( 90, max( 1, $elapsed ) );

		return $elapsed . "'";
	}

	/**
	 * =========================================================
	 * NHL
	 * =========================================================
	 */
	private function get_nhl() {

		$json =
			$this->remote_json(
				'https://api-web.nhle.com/v1/score/now',
				'NHL'
			);

		if (
			is_wp_error(
				$json
			)
		) {
			return $json;
		}

		if (
			empty(
				$json['games']
			) ||
			! is_array(
				$json['games']
			)
		) {
			return array();
		}

		$output =
			array();

		foreach (
			$json['games']
			as $game
		) {

			if (
				! is_array(
					$game
				)
			) {
				continue;
			}

			$home_data =
				isset(
					$game['homeTeam']
				) &&
				is_array(
					$game['homeTeam']
				)
					? $game['homeTeam']
					: array();

			$away_data =
				isset(
					$game['awayTeam']
				) &&
				is_array(
					$game['awayTeam']
				)
					? $game['awayTeam']
					: array();

			$home =
				$this->nhl_team_name(
					$home_data
				);

			$away =
				$this->nhl_team_name(
					$away_data
				);

			if (
				! $home ||
				! $away
			) {
				continue;
			}

			$timestamp =
				! empty(
					$game['startTimeUTC']
				)
					? $this->parse_timestamp(
						$game['startTimeUTC']
					)
					: 0;

			$game_state =
				isset(
					$game['gameState']
				)
					? strtoupper(
						sanitize_text_field(
							(string) $game['gameState']
						)
					)
					: '';

			if (
				in_array(
					$game_state,
					array(
						'LIVE',
						'CRIT',
					),
					true
				)
			) {

				$state =
					'live';

			} elseif (
				in_array(
					$game_state,
					array(
						'FINAL',
						'OFF',
					),
					true
				)
			) {

				$state =
					'final';

			} else {

				$state =
					'upcoming';
			}

			if (
				'live' !==
					$state &&
				(
					! $timestamp ||
					! $this->inside_matchday(
						$timestamp
					)
				)
			) {
				continue;
			}

			$output[] = array(
				'home' =>
					$home,

				'away' =>
					$away,

				'home_logo' =>
					isset(
						$home_data['logo']
					)
						? esc_url_raw(
							(string) $home_data['logo']
						)
						: '',

				'away_logo' =>
					isset(
						$away_data['logo']
					)
						? esc_url_raw(
							(string) $away_data['logo']
						)
						: '',

				'score' =>
					$this->safe_score(
						isset(
							$home_data['score']
						)
							? $home_data['score']
							: null
					) .
						' - ' .
						$this->safe_score(
							isset(
								$away_data['score']
							)
								? $away_data['score']
								: null
						),

				'status' =>
					$this->nhl_status(
						$game,
						$state
					),

				'state' =>
					$state,

				'start_ts' =>
					$timestamp,

				'kickoff_wib' =>
					$timestamp
						? wp_date(
							'H:i',
							$timestamp,
							$this->timezone()
						)
						: '',

				'next_morning' =>
					$timestamp
						? $this->next_morning(
							$timestamp
						)
						: false,

				'competition' =>
					'NHL',

				'region' =>
					'North America',

				'round' =>
					'',

				'provider' =>
					'NHL',

				'priority' =>
					100,
			);
		}

		return $output;
	}

	private function nhl_team_name( $team ) {

		if (
			isset(
				$team['name']['default']
			)
		) {

			return sanitize_text_field(
				(string)
					$team['name']['default']
			);
		}

		$place =
			isset(
				$team['placeName']['default']
			)
				? sanitize_text_field(
					(string)
						$team['placeName']['default']
				)
				: '';

		$common =
			isset(
				$team['commonName']['default']
			)
				? sanitize_text_field(
					(string)
						$team['commonName']['default']
				)
				: '';

		if (
			$place &&
			$common
		) {

			return trim(
				$place .
					' ' .
					$common
			);
		}

		if ( $common ) {
			return $common;
		}

		return isset(
			$team['abbrev']
		)
			? sanitize_text_field(
				(string)
					$team['abbrev']
			)
			: '';
	}

	private function nhl_status(
		$game,
		$state
	) {

		if (
			'upcoming' ===
				$state
		) {
			return 'Belum Mulai';
		}

		if (
			'final' ===
				$state
		) {
			return 'Final';
		}

		if (
			! empty(
				$game['clock']['inIntermission']
			)
		) {
			return 'Istirahat';
		}

		$period =
			isset(
				$game['periodDescriptor']['number']
			)
				? absint(
					$game['periodDescriptor']['number']
				)
				: 0;

		$status =
			$period
				? sprintf(
					'Periode %d',
					$period
				)
				: 'Live';

		if (
			isset(
				$game['clock']['timeRemaining']
			)
		) {

			$clock =
				sanitize_text_field(
					(string)
						$game['clock']['timeRemaining']
				);

			if ( $clock ) {

				$status .=
					' • ' .
					$clock;
			}
		}

		return $status;
	}

	/**
	 * =========================================================
	 * MERGE / ANTI DUPLIKAT
	 * =========================================================
	 */
	private function merge_sources( $sources ) {

		$result =
			array();

		foreach (
			$sources
			as $source
		) {

			if (
				! is_array(
					$source
				)
			) {
				continue;
			}

			foreach (
				$source
				as $incoming
			) {

				if (
					! is_array(
						$incoming
					) ||
					empty(
						$incoming['home']
					) ||
					empty(
						$incoming['away']
					)
				) {
					continue;
				}

				$index =
					$this->find_matching_match(
						$result,
						$incoming
					);

				if (
					false ===
						$index
				) {

					$result[] =
						$incoming;

				} else {

					$result[ $index ] =
						$this->merge_two_matches(
							$result[ $index ],
							$incoming
						);
				}
			}
		}

		foreach (
			$result
			as &$match
		) {

			unset(
				$match['priority']
			);
		}

		unset( $match );

		return $result;
	}

	private function find_matching_match(
		$matches,
		$incoming
	) {

		foreach (
			$matches
			as $index => $existing
		) {

			if (
				! $this->team_similar(
					$existing['home'],
					$incoming['home']
				) ||
				! $this->team_similar(
					$existing['away'],
					$incoming['away']
				)
			) {
				continue;
			}

			if (
				! empty(
					$existing['start_ts']
				) &&
				! empty(
					$incoming['start_ts']
				)
			) {

				$difference =
					abs(
						(int)
							$existing['start_ts'] -
						(int)
							$incoming['start_ts']
					);

				if (
					$difference >
						8 *
						HOUR_IN_SECONDS
				) {
					continue;
				}
			}

			return $index;
		}

		return false;
	}

	private function merge_two_matches(
		$existing,
		$incoming
	) {

		$existing_priority =
			isset(
				$existing['priority']
			)
				? (int)
					$existing['priority']
				: 0;

		$incoming_priority =
			isset(
				$incoming['priority']
			)
				? (int)
					$incoming['priority']
				: 0;

		$state_rank = array(
			'upcoming' =>
				10,

			'other' =>
				20,

			'live' =>
				30,

			'final' =>
				40,
		);

		$existing_state =
			isset(
				$existing['state']
			)
				? $existing['state']
				: 'other';

		$incoming_state =
			isset(
				$incoming['state']
			)
				? $incoming['state']
				: 'other';

		$existing_rank =
			isset(
				$state_rank[
					$existing_state
				]
			)
				? $state_rank[
					$existing_state
				]
				: 20;

		$incoming_rank =
			isset(
				$state_rank[
					$incoming_state
				]
			)
				? $state_rank[
					$incoming_state
				]
				: 20;

		$incoming_wins =
			(
				$incoming_rank >
					$existing_rank
			) ||
			(
				$incoming_rank ===
					$existing_rank &&
				$incoming_priority >
					$existing_priority
			);

		if (
			$incoming_wins
		) {

			$existing['state'] =
				$incoming_state;

			$existing['status'] =
				$incoming['status'];

			if ( ! empty( $incoming['minute'] ) ) {
				$existing['minute'] = $incoming['minute'];
			}

			$existing['provider'] =
				$incoming['provider'];

			$existing['priority'] =
				$incoming_priority;
		}

		if (
			$this->has_real_score(
				isset(
					$incoming['score']
				)
					? $incoming['score']
					: ''
			) &&
			(
				$incoming_rank >=
					$existing_rank ||
				$incoming_priority >
					$existing_priority
			)
		) {

			$existing['score'] =
				$incoming['score'];
		}

		foreach (
			array(
				'home_logo',
				'away_logo',
				'competition',
				'competition_logo',
				'region',
				'region_logo',
				'region_code',
				'round',
				'minute',
				'minute_synced_at',
				'minute_source',
				'sportscore_id',
				'sportscore_slug',
			)
			as $field
		) {

			if (
				! empty(
					$incoming[
						$field
					]
				) &&
				(
					empty(
						$existing[
							$field
						]
					) ||
					$incoming_priority >
						$existing_priority
				)
			) {

				$existing[
					$field
				] =
					$incoming[
						$field
					];
			}
		}

		if (
			! empty(
				$incoming['start_ts']
			) &&
			(
				empty(
					$existing['start_ts']
				) ||
				$incoming_priority >
					$existing_priority
			)
		) {

			$existing['start_ts'] =
				$incoming['start_ts'];

			$existing['kickoff_wib'] =
				$incoming['kickoff_wib'];

			$existing['next_morning'] =
				$incoming['next_morning'];
		}

		return $existing;
	}

	private function has_real_score( $score ) {

		return (bool)
			preg_match(
				'/\d/',
				(string) $score
			);
	}

	private function team_similar(
		$a,
		$b
	) {

		$a =
			$this->normalize_team_name(
				$a
			);

		$b =
			$this->normalize_team_name(
				$b
			);

		if (
			! $a ||
			! $b
		) {
			return false;
		}

		if (
			$a ===
				$b
		) {
			return true;
		}

		if (
			strlen( $a ) >= 4 &&
			strlen( $b ) >= 4 &&
			(
				false !==
					strpos(
						$a,
						$b
					) ||
				false !==
					strpos(
						$b,
						$a
					)
			)
		) {
			return true;
		}

		$percentage =
			0;

		similar_text(
			$a,
			$b,
			$percentage
		);

		return (
			$percentage >=
				86
		);
	}

	private function normalize_team_name( $name ) {

		$name =
			remove_accents(
				(string) $name
			);

		$name =
			strtolower(
				trim(
					$name
				)
			);

		$name =
			str_replace(
				array(
					'&',
					'.',
					',',
					"'",
					'’',
					'-',
					'_',
				),
				' ',
				$name
			);

		$name =
			preg_replace(
				'/[^a-z0-9 ]+/',
				' ',
				$name
			);

		$name =
			preg_replace(
				'/\b(fc|cf|sc|afc|ac|rc|cd|sd|ud|fk|sk|club)\b/',
				' ',
				$name
			);

		$name =
			trim(
				preg_replace(
					'/\s+/',
					' ',
					$name
				)
			);

		$aliases = array(
			'man city' =>
				'manchester city',

			'man utd' =>
				'manchester united',

			'manchester utd' =>
				'manchester united',

			'internazionale' =>
				'inter',

			'inter milan' =>
				'inter',

			'paris saint germain' =>
				'psg',

			'lask linz' =>
				'lask',

			'borussia dortmund' =>
				'dortmund',

			'lille osc' =>
				'lille',

			'real betis balompie' =>
				'real betis',

			'aek athina' =>
				'aek athens',

			'celta de vigo' =>
				'celta vigo',
		);

		return isset(
			$aliases[
				$name
			]
		)
			? $aliases[
				$name
			]
			: $name;
	}

	private function sort_matches( $matches ) {

		$ranks = array(
			'live' =>
				0,

			'upcoming' =>
				1,

			'other' =>
				2,

			'final' =>
				3,
		);

		usort(
			$matches,
			function(
				$a,
				$b
			) use (
				$ranks
			) {

				$state_a =
					isset(
						$a['state']
					)
						? $a['state']
						: 'other';

				$state_b =
					isset(
						$b['state']
					)
						? $b['state']
						: 'other';

				$rank_a =
					isset(
						$ranks[
							$state_a
						]
					)
						? $ranks[
							$state_a
						]
						: 2;

				$rank_b =
					isset(
						$ranks[
							$state_b
						]
					)
						? $ranks[
							$state_b
						]
						: 2;

				if (
					$rank_a !==
						$rank_b
				) {

					return (
						$rank_a <
							$rank_b
					)
						? -1
						: 1;
				}

				$time_a =
					! empty(
						$a['start_ts']
					)
						? (int)
							$a['start_ts']
						: PHP_INT_MAX;

				$time_b =
					! empty(
						$b['start_ts']
					)
						? (int)
							$b['start_ts']
						: PHP_INT_MAX;

				if (
					'final' ===
						$state_a
				) {

					return (
						$time_b <=>
						$time_a
					);
				}

				return (
					$time_a <=>
					$time_b
				);
			}
		);

		return $matches;
	}

	/**
	 * =========================================================
	 * GENERIC PARSERS
	 * =========================================================
	 */
	private function first_scalar(
		$array,
		$keys
	) {

		foreach (
			$keys
			as $key
		) {

			if (
				array_key_exists(
					$key,
					$array
				) &&
				is_scalar(
					$array[
						$key
					]
				)
			) {

				return sanitize_text_field(
					(string)
						$array[
							$key
						]
				);
			}
		}

		return '';
	}

	private function extract_live_minute( $array, $state, $status_text = '' ) {

		if ( 'live' !== $state || ! is_array( $array ) ) {
			return '';
		}

		$candidates = array();

		if ( is_scalar( $status_text ) && '' !== trim( (string) $status_text ) ) {
			$candidates[] = (string) $status_text;
		}

		foreach (
			array(
				'minute',
				'minutes',
				'match_minute',
				'matchMinute',
				'elapsed',
				'elapsed_time',
				'elapsedTime',
				'live_minute',
				'liveMinute',
				'clock',
				'timer',
				'status_text',
				'statusText',
			)
			as $key
		) {
			if ( isset( $array[ $key ] ) && is_scalar( $array[ $key ] ) ) {
				$candidates[] = (string) $array[ $key ];
			}
		}

		foreach ( array( 'status', 'match_status', 'matchStatus', 'live', 'clock', 'timer', 'period' ) as $parent ) {
			if ( empty( $array[ $parent ] ) || ! is_array( $array[ $parent ] ) ) {
				continue;
			}

			foreach ( array( 'minute', 'minutes', 'elapsed', 'value', 'text', 'display', 'status_text', 'statusText' ) as $key ) {
				if ( isset( $array[ $parent ][ $key ] ) && is_scalar( $array[ $parent ][ $key ] ) ) {
					$candidates[] = (string) $array[ $parent ][ $key ];
				}
			}
		}

		foreach ( $candidates as $candidate ) {
			$value = trim( sanitize_text_field( (string) $candidate ) );

			if ( '' === $value ) {
				continue;
			}

			if ( preg_match( '/^(HT|HALF[ -]?TIME)$/i', $value ) ) {
				return 'HT';
			}

			if ( preg_match( '/^(\d{1,3}(?:\+\d{1,2})?)[\'’]?$/u', $value, $m ) ) {
				return $m[1] . "'";
			}

			if ( preg_match( '/^(?:MIN(?:UTE)?\.?\s*)?(\d{1,3}(?:\+\d{1,2})?)\s*(?:MIN(?:UTE)?S?)?[\'’]?$/iu', $value, $m ) ) {
				return $m[1] . "'";
			}
		}

		return '';
	}

	private function extract_team(
		$array,
		$keys
	) {

		foreach (
			$keys
			as $key
		) {

			if (
				! isset(
					$array[
						$key
					]
				)
			) {
				continue;
			}

			$value =
				$array[
					$key
				];

			if (
				is_scalar(
					$value
				)
			) {

				return sanitize_text_field(
					(string)
						$value
				);
			}

			if (
				is_array(
					$value
				)
			) {

				foreach (
					array(
						'name',
						'display_name',
						'displayName',
						'short_name',
						'shortName',
						'title',
					)
					as $field
				) {

					if (
						isset(
							$value[
								$field
							]
						) &&
						is_scalar(
							$value[
								$field
							]
						)
					) {

						return sanitize_text_field(
							(string)
								$value[
									$field
								]
						);
					}
				}
			}
		}

		return '';
	}

	private function extract_competition( $array ) {

		foreach (
			array(
				'competition',
				'league',
				'tournament',
				'competition_name',
				'category',
			)
			as $key
		) {

			if (
				! isset(
					$array[
						$key
					]
				)
			) {
				continue;
			}

			$value =
				$array[
					$key
				];

			if (
				is_scalar(
					$value
				)
			) {

				return sanitize_text_field(
					(string)
						$value
				);
			}

			if (
				is_array(
					$value
				)
			) {

				foreach (
					array(
						'name',
						'title',
						'displayName',
					)
					as $field
				) {

					if (
						isset(
							$value[
								$field
							]
						) &&
						is_scalar(
							$value[
								$field
							]
						)
					) {

						return sanitize_text_field(
							(string)
								$value[
									$field
								]
						);
					}
				}
			}
		}

		return '';
	}



	private function extract_competition_logo( $array ) {

		foreach (
			array(
				'competition_logo',
				'competitionLogo',
				'league_logo',
				'leagueLogo',
				'tournament_logo',
				'tournamentLogo',
				'category_logo',
				'categoryLogo',
			)
			as $key
		) {
			if ( isset( $array[ $key ] ) && is_scalar( $array[ $key ] ) ) {
				$url = esc_url_raw( (string) $array[ $key ] );
				if ( $url ) {
					return $url;
				}
			}
		}

		foreach ( array( 'competition', 'league', 'tournament', 'category' ) as $parent ) {
			if ( empty( $array[ $parent ] ) || ! is_array( $array[ $parent ] ) ) {
				continue;
			}

			foreach ( array( 'logo', 'image', 'icon', 'badge', 'crest', 'picture', 'photo' ) as $field ) {
				if ( isset( $array[ $parent ][ $field ] ) && is_scalar( $array[ $parent ][ $field ] ) ) {
					$url = esc_url_raw( (string) $array[ $parent ][ $field ] );
					if ( $url ) {
						return $url;
					}
				}
			}

			foreach ( array( 'logo', 'image', 'icon' ) as $nested ) {
				if ( ! empty( $array[ $parent ][ $nested ] ) && is_array( $array[ $parent ][ $nested ] ) ) {
					foreach ( array( 'url', 'src', 'image', 'logo' ) as $field ) {
						if ( isset( $array[ $parent ][ $nested ][ $field ] ) && is_scalar( $array[ $parent ][ $nested ][ $field ] ) ) {
							$url = esc_url_raw( (string) $array[ $parent ][ $nested ][ $field ] );
							if ( $url ) {
								return $url;
							}
						}
					}
				}
			}
		}

		return '';
	}

	private function extract_region_logo( $array ) {

		foreach ( array( 'country_logo', 'countryLogo', 'region_logo', 'regionLogo', 'flag', 'flag_url', 'flagUrl' ) as $key ) {
			if ( isset( $array[ $key ] ) && is_scalar( $array[ $key ] ) ) {
				$url = esc_url_raw( (string) $array[ $key ] );
				if ( $url ) {
					return $url;
				}
			}
		}

		foreach ( array( 'country', 'region', 'area' ) as $parent ) {
			if ( empty( $array[ $parent ] ) || ! is_array( $array[ $parent ] ) ) {
				continue;
			}
			foreach ( array( 'flag', 'logo', 'image', 'icon', 'badge' ) as $field ) {
				if ( isset( $array[ $parent ][ $field ] ) && is_scalar( $array[ $parent ][ $field ] ) ) {
					$url = esc_url_raw( (string) $array[ $parent ][ $field ] );
					if ( $url ) {
						return $url;
					}
				}
			}
		}

		foreach ( array( 'competition', 'league', 'tournament', 'category' ) as $parent ) {
			if ( isset( $array[ $parent ] ) && is_array( $array[ $parent ] ) ) {
				$nested = $this->extract_region_logo( $array[ $parent ] );
				if ( $nested ) {
					return $nested;
				}
			}
		}

		return '';
	}

	private function extract_region_code( $array ) {

		foreach ( array( 'country_code', 'countryCode', 'region_code', 'regionCode', 'country_iso', 'countryIso', 'iso2' ) as $key ) {
			if ( isset( $array[ $key ] ) && is_scalar( $array[ $key ] ) ) {
				$value = strtoupper( sanitize_text_field( (string) $array[ $key ] ) );
				if ( preg_match( '/^[A-Z]{2}$/', $value ) ) {
					return $value;
				}
			}
		}

		foreach ( array( 'country', 'region', 'area' ) as $parent ) {
			if ( empty( $array[ $parent ] ) || ! is_array( $array[ $parent ] ) ) {
				continue;
			}
			foreach ( array( 'code', 'iso2', 'alpha2', 'country_code', 'countryCode' ) as $field ) {
				if ( isset( $array[ $parent ][ $field ] ) && is_scalar( $array[ $parent ][ $field ] ) ) {
					$value = strtoupper( sanitize_text_field( (string) $array[ $parent ][ $field ] ) );
					if ( preg_match( '/^[A-Z]{2}$/', $value ) ) {
						return $value;
					}
				}
			}
		}

		foreach ( array( 'competition', 'league', 'tournament', 'category' ) as $parent ) {
			if ( isset( $array[ $parent ] ) && is_array( $array[ $parent ] ) ) {
				$nested = $this->extract_region_code( $array[ $parent ] );
				if ( $nested ) {
					return $nested;
				}
			}
		}

		return '';
	}

	private function extract_region( $array ) {

		foreach (
			array(
				'country',
				'region',
				'area',
				'country_name',
				'countryName',
			)
			as $key
		) {

			if ( ! isset( $array[ $key ] ) ) {
				continue;
			}

			$value = $array[ $key ];

			if ( is_scalar( $value ) ) {
				return sanitize_text_field( (string) $value );
			}

			if ( is_array( $value ) ) {
				foreach ( array( 'name', 'title', 'displayName', 'country' ) as $field ) {
					if ( isset( $value[ $field ] ) && is_scalar( $value[ $field ] ) ) {
						return sanitize_text_field( (string) $value[ $field ] );
					}
				}
			}
		}

		foreach ( array( 'competition', 'league', 'tournament', 'category' ) as $parent ) {
			if ( isset( $array[ $parent ] ) && is_array( $array[ $parent ] ) ) {
				$nested = $this->extract_region( $array[ $parent ] );
				if ( $nested ) {
					return $nested;
				}
			}
		}

		return '';
	}

	private function extract_round( $array ) {

		foreach (
			array(
				'round',
				'round_name',
				'roundName',
				'matchday',
				'match_day',
				'matchDay',
				'week',
				'gameweek',
			)
			as $key
		) {

			if ( ! isset( $array[ $key ] ) ) {
				continue;
			}

			$value = $array[ $key ];

			if ( is_numeric( $value ) ) {
				return 'Round ' . absint( $value );
			}

			if ( is_scalar( $value ) ) {
				$value = sanitize_text_field( (string) $value );
				if ( $value === '' ) {
					continue;
				}
				if ( preg_match( '/^(round|matchday|week)\b/i', $value ) ) {
					return $value;
				}
				return 'Round ' . $value;
			}

			if ( is_array( $value ) ) {
				foreach ( array( 'name', 'title', 'number', 'value' ) as $field ) {
					if ( isset( $value[ $field ] ) && is_scalar( $value[ $field ] ) ) {
						$found = $value[ $field ];
						if ( is_numeric( $found ) ) {
							return 'Round ' . absint( $found );
						}
						$found = sanitize_text_field( (string) $found );
						if ( $found !== '' ) {
							return preg_match( '/^(round|matchday|week)\b/i', $found ) ? $found : 'Round ' . $found;
						}
					}
				}
			}
		}

		foreach ( array( 'competition', 'league', 'tournament', 'category', 'season' ) as $parent ) {
			if ( isset( $array[ $parent ] ) && is_array( $array[ $parent ] ) ) {
				$nested = $this->extract_round( $array[ $parent ] );
				if ( $nested ) {
					return $nested;
				}
			}
		}

		return '';
	}

	private function extract_logo(
		$array,
		$side
	) {

		$keys = array(
			$side . '_logo',
			$side . 'Logo',
			$side . '_image',
			$side . 'Image',
			$side . '_crest',
			$side . 'Crest',
		);

		foreach (
			$keys
			as $key
		) {

			if (
				isset(
					$array[
						$key
					]
				) &&
				is_scalar(
					$array[
						$key
					]
				)
			) {

				return esc_url_raw(
					(string)
						$array[
							$key
						]
				);
			}
		}

		foreach (
			array(
				$side,
				$side . '_team',
				$side . 'Team',
			)
			as $nested
		) {

			if (
				empty(
					$array[
						$nested
					]
				) ||
				! is_array(
					$array[
						$nested
					]
				)
			) {
				continue;
			}

			foreach (
				array(
					'logo',
					'image',
					'crest',
					'badge',
				)
				as $field
			) {

				if (
					isset(
						$array[
							$nested
						][
							$field
						]
					) &&
					is_scalar(
						$array[
							$nested
						][
							$field
						]
					)
				) {

					return esc_url_raw(
						(string)
							$array[
								$nested
							][
								$field
							]
					);
				}
			}
		}

		return '';
	}

	private function extract_timestamp( $array ) {

		foreach (
			array(
				'time',
				'start_time',
				'startTime',
				'start_timestamp',
				'start_ts',
				'timestamp',
				'startTimeUTC',
				'datetime',
				'date_time',
			)
			as $field
		) {

			if (
				! array_key_exists(
					$field,
					$array
				)
			) {
				continue;
			}

			$timestamp =
				$this->parse_timestamp(
					$array[
						$field
					]
				);

			if (
				$timestamp
			) {
				return $timestamp;
			}
		}

		return 0;
	}

	private function parse_timestamp( $value ) {

		if (
			! is_scalar(
				$value
			)
		) {
			return 0;
		}

		$value =
			trim(
				(string)
					$value
			);

		if (
			'' ===
				$value
		) {
			return 0;
		}

		if (
			is_numeric(
				$value
			)
		) {

			$number =
				(float)
					$value;

			if (
				$number >
					100000000000
			) {

				return (int)
					floor(
						$number /
							1000
					);
			}

			if (
				$number >
					1000000000
			) {

				return (int)
					$number;
			}
		}

		$timestamp =
			strtotime(
				$value
			);

		return (
			false !==
				$timestamp
		)
			? $timestamp
			: 0;
	}

	private function utc_datetime_timestamp(
		$date,
		$time
	) {

		try {

			$datetime =
				new DateTimeImmutable(
					$date .
						' ' .
						$time,
					new DateTimeZone(
						'UTC'
					)
				);

			return $datetime
				->getTimestamp();

		} catch (
			Exception $e
		) {

			return 0;
		}
	}

	private function safe_score( $value ) {

		if (
			null ===
				$value ||
			'' ===
				$value
		) {
			return '-';
		}

		return is_scalar(
			$value
		)
			? sanitize_text_field(
				(string)
					$value
			)
			: '-';
	}

	private function extract_score( $match ) {

		$home =
			$this->first_scalar(
				$match,
				array(
					'home_score',
					'homeScore',
					'score_home',
					'scoreHome',
				)
			);

		$away =
			$this->first_scalar(
				$match,
				array(
					'away_score',
					'awayScore',
					'score_away',
					'scoreAway',
				)
			);

		if (
			'' !==
				$home ||
			'' !==
				$away
		) {

			return $this->safe_score(
				$home
			) .
				' - ' .
				$this->safe_score(
					$away
				);
		}

		if (
			isset(
				$match['score']
			) &&
			is_scalar(
				$match['score']
			)
		) {

			return sanitize_text_field(
				(string)
					$match['score']
			);
		}

		if (
			isset(
				$match['score']
			) &&
			is_array(
				$match['score']
			)
		) {

			$home_score =
				isset(
					$match['score']['home']
				)
					? $this->safe_score(
						$match['score']['home']
					)
					: '-';

			$away_score =
				isset(
					$match['score']['away']
				)
					? $this->safe_score(
						$match['score']['away']
					)
					: '-';

			return $home_score .
				' - ' .
				$away_score;
		}

		return '- - -';
	}

	private function classify_status(
		$status,
		$timestamp
	) {

		$status =
			strtolower(
				trim(
					(string)
						$status
				)
			);

		foreach (
			array(
				'final',
				'finished',
				'completed',
				'complete',
				'full time',
				'full-time',
				'ft',
				'ended',
				'retired',
			)
			as $word
		) {

			if (
				$status ===
					$word ||
				false !==
					strpos(
						$status,
						$word
					)
			) {

				return 'final';
			}
		}

		foreach (
			array(
				'scheduled',
				'not started',
				'not_started',
				'upcoming',
				'pregame',
				'pre-game',
				'future',
			)
			as $word
		) {

			if (
				$status ===
					$word ||
				false !==
					strpos(
						$status,
						$word
					)
			) {

				return 'upcoming';
			}
		}

		foreach (
			array(
				'live',
				'in progress',
				'in_progress',
				'inprogress',
				'playing',
				'halftime',
				'half time',
				'first half',
				'second half',
				'quarter',
				'overtime',
				'period',
				'innings',
				'inning',
				'set ',
				'q1',
				'q2',
				'q3',
				'q4',
			)
			as $word
		) {

			if (
				$status ===
					$word ||
				false !==
					strpos(
						$status,
						$word
					)
			) {

				return 'live';
			}
		}

		if (
			preg_match(
				'/^\d{1,3}(?:\+\d{1,2})?[\'’]?$/u',
				$status
			)
		) {

			return 'live';
		}

		if (
			'' ===
				$status &&
			$timestamp >
				time()
		) {

			return 'upcoming';
		}

		return 'other';
	}

	private function normalize_status(
		$status,
		$state
	) {

		$status =
			trim(
				sanitize_text_field(
					(string)
						$status
				)
			);

		$key =
			strtolower(
				str_replace(
					array(
						' ',
						'-',
					),
					'_',
					$status
				)
			);

		$map = array(
			'ns' =>
				'Belum Mulai',

			'scheduled' =>
				'Belum Mulai',

			'not_started' =>
				'Belum Mulai',

			'upcoming' =>
				'Belum Mulai',

			'live' =>
				'Live',

			'in_progress' =>
				'Live',

			'inprogress' =>
				'Live',

			'1h' =>
				'Babak 1',

			'first_half' =>
				'Babak 1',

			'ht' =>
				'Turun Minum',

			'halftime' =>
				'Turun Minum',

			'half_time' =>
				'Turun Minum',

			'2h' =>
				'Babak 2',

			'second_half' =>
				'Babak 2',

			'q1' =>
				'Kuarter 1',

			'q2' =>
				'Kuarter 2',

			'q3' =>
				'Kuarter 3',

			'q4' =>
				'Kuarter 4',

			'ft' =>
				'Final',

			'final' =>
				'Final',

			'finished' =>
				'Final',

			'completed' =>
				'Final',

			'overtime' =>
				'Overtime',

			'ot' =>
				'Overtime',

			'postponed' =>
				'Ditunda',

			'cancelled' =>
				'Dibatalkan',

			'canceled' =>
				'Dibatalkan',

			'suspended' =>
				'Dihentikan',
		);

		if (
			isset(
				$map[
					$key
				]
			)
		) {

			return $map[
				$key
			];
		}

		if (
			'live' ===
				$state &&
			! $status
		) {

			return 'Live';
		}

		if (
			'upcoming' ===
				$state &&
			! $status
		) {

			return 'Belum Mulai';
		}

		if (
			'final' ===
				$state &&
			! $status
		) {

			return 'Final';
		}

		return $status
			? $status
			: '-';
	}

	/**
	 * =========================================================
	 * SHORTCODE
	 * =========================================================
	 */
	public function render_shortcode( $atts ) {

		$atts =
			shortcode_atts(
				array(
					'sport' =>
						'football',

					'featured' =>
						4,
				),
				$atts,
				'livescore_linetogel'
			);

		$initial_sport =
			sanitize_key(
				$atts['sport']
			);

		if (
			! isset(
				self::$sports[
					$initial_sport
				]
			)
		) {

			$initial_sport =
				'football';
		}

		$featured_count =
			max(
				1,
				min(
					8,
					absint(
						$atts['featured']
					)
				)
			);

		$settings =
			$this->get_settings();

		$id =
			'lsl254-' .
			wp_unique_id();

		$config = array(
			'id' =>
				$id,

			'ajaxUrl' =>
				admin_url(
					'admin-ajax.php'
				),

			'action' =>
				self::AJAX_ACTION,

			'minuteAction' =>
				self::MINUTE_AJAX_ACTION,

			'nonce' =>
				wp_create_nonce(
					self::NONCE_ACTION
				),

			'sport' =>
				$initial_sport,

			'highTraffic' =>
				self::HIGH_TRAFFIC_MODE,

			'restScoresUrl' =>
				trailingslashit( rest_url( 'live-score-linetogel/v1/scores' ) ),

			'interval' =>
				30000,

			'idleInterval' =>
				60000,

			'jitter' =>
				12000,

			'minuteInterval' =>
				30000,

			'featured' =>
				$featured_count,

			'logoBase' =>
				self::LOGO_DB_BASE,

			'directUrl' =>
				$settings['direct_url'],
		);

		ob_start();

		if (
			! self::$css_printed
		) {

			self::$css_printed =
				true;
			?>

<style>
.lsl254{
	--accent:#d946ef;--accent2:#8b5cf6;--gold:#f5c75a;--danger:#ff3857;--success:#27d17f;
	--bg:#070a12;--surface:#0b101b;--surface2:#0e1422;--line:rgba(255,255,255,.07);--text:#f5f7fc;--muted:#8591a8;
	width:100%;margin:14px auto;color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif
}
.lsl254 *{box-sizing:border-box}.lsl254 [hidden]{display:none!important}
.lsl254-shell{position:relative;width:100%;border:1px solid rgba(255,255,255,.065);border-radius:24px;background:radial-gradient(circle at 18% -12%,rgba(217,70,239,.16),transparent 31%),radial-gradient(circle at 95% 0%,rgba(139,92,246,.10),transparent 25%),linear-gradient(180deg,#090d17 0%,#070a12 100%);box-shadow:0 28px 70px rgba(0,0,0,.35),0 0 0 1px rgba(217,70,239,.025) inset;overflow:hidden}
.lsl254-shell:before{content:"";position:absolute;inset:0 0 auto;height:2px;z-index:2;background:linear-gradient(90deg,transparent 3%,var(--accent) 28%,var(--gold) 50%,var(--accent2) 72%,transparent 97%);opacity:.78}
/* HEADER / HERO */
.lsl254-hero{position:relative;display:grid;grid-template-columns:230px minmax(0,1fr) auto;align-items:center;gap:24px;margin:18px 18px 12px;padding:22px 24px;border:1px solid rgba(255,255,255,.07);border-radius:22px;background:radial-gradient(circle at 79% 10%,rgba(217,70,239,.18),transparent 29%),linear-gradient(120deg,rgba(20,17,39,.97),rgba(14,16,29,.92) 58%,rgba(31,15,43,.88));box-shadow:0 18px 45px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035);overflow:hidden}
.lsl254-hero:after{content:"";position:absolute;right:-80px;bottom:-110px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(217,70,239,.22),transparent 68%);filter:blur(4px);pointer-events:none}
.lsl254-hero-logo{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;height:132px;padding:12px;border:1px solid rgba(255,255,255,.065);border-radius:19px;background:linear-gradient(145deg,#090b14,#070911);box-shadow:0 14px 35px rgba(0,0,0,.28)}
.lsl254-hero-logo-link{display:flex;align-items:center;justify-content:center;width:100%;height:100%;text-decoration:none!important;overflow:hidden;border-radius:14px}.lsl254-hero-logo img{display:block;max-width:210px;max-height:100px;width:auto;height:auto;object-fit:contain;transform:scale(1.65);transform-origin:center;filter:drop-shadow(0 8px 18px rgba(0,0,0,.42));transition:transform .22s ease,filter .22s ease}.lsl254-hero-logo-link:hover img{transform:scale(1.76);filter:drop-shadow(0 9px 21px rgba(217,70,239,.22))}
.lsl254-hero-copy{position:relative;z-index:1;min-width:0}
.lsl254-kicker{display:flex;align-items:center;gap:9px;margin-bottom:7px;color:var(--gold);font-size:10px;font-weight:950;letter-spacing:1.15px;text-transform:uppercase}.lsl254-kicker:before{content:"";width:22px;height:2px;border-radius:99px;background:var(--gold);box-shadow:0 0 10px rgba(245,199,90,.28)}
.lsl254-hero-title{margin:0;color:#fff;font-family:Georgia,"Times New Roman",serif;font-size:42px;font-weight:950;line-height:1;letter-spacing:-1px}.lsl254-hero-title span{color:#e14df2;text-shadow:0 0 22px rgba(217,70,239,.27)}
.lsl254-hero-sub{max-width:760px;margin:10px 0 0;color:#d2d9e7;font-size:12px;font-weight:650;line-height:1.65}
.lsl254-hero-cta{position:relative;z-index:1;align-self:center;display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:185px}.lsl254-hero-cta-label{color:#7e8aa0;font-size:8px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.lsl254-hero-cta-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:0 16px;border:1px solid rgba(245,199,90,.24);border-radius:14px;background:linear-gradient(135deg,rgba(245,199,90,.16),rgba(217,70,239,.17) 52%,rgba(139,92,246,.18));color:#fff!important;font-size:10px;font-weight:950;letter-spacing:.2px;text-decoration:none!important;box-shadow:0 12px 30px rgba(0,0,0,.18),0 0 0 1px rgba(255,255,255,.025) inset;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.lsl254-hero-cta-btn:hover{transform:translateY(-2px);border-color:rgba(245,199,90,.42);box-shadow:0 16px 34px rgba(0,0,0,.22),0 0 22px rgba(217,70,239,.12)}.lsl254-hero-cta-arrow{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border-radius:9px;background:rgba(255,255,255,.09);font-size:14px;line-height:1}

/* STATUS + RUNNING TEXT */
.lsl254-statusbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 18px 10px;padding:10px 14px;border:1px solid rgba(255,255,255,.055);border-radius:14px;background:rgba(8,12,23,.74)}
.lsl254-statusbar-main{display:flex;align-items:center;gap:9px;min-width:0}.lsl254-status-dot{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 4px rgba(39,209,127,.08),0 0 10px rgba(39,209,127,.48)}.lsl254-statusbar-main strong{color:#fff;font-size:10px;font-weight:900}.lsl254-statusbar-main span{color:#c8d1e2;font-size:10px;font-weight:850}.lsl254-statusbar-note{color:#758299;font-size:9px;font-weight:750}
.lsl254-ticker{display:flex;align-items:center;gap:12px;margin:0 18px 12px;padding:0 12px;border:1px solid rgba(255,255,255,.055);border-radius:14px;background:linear-gradient(90deg,rgba(10,14,26,.95),rgba(14,12,27,.92));overflow:hidden}
.lsl254-ticker-label{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border-radius:9px;background:rgba(245,199,90,.10);color:var(--gold);font-size:9px;font-weight:950;letter-spacing:.4px}.lsl254-ticker-label:before{content:"●";color:#ff4c66;font-size:8px}
.lsl254-ticker-window{flex:1;min-width:0;overflow:hidden;padding:10px 0}.lsl254-ticker-track{display:inline-block;min-width:100%;white-space:nowrap;color:#cbd4e4;font-size:9px;font-weight:800;letter-spacing:.2px;animation:lsl254TickerFlow 28s linear infinite;will-change:transform}.lsl254-ticker:hover .lsl254-ticker-track{animation-play-state:paused}@keyframes lsl254TickerFlow{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}

/* NAV + SEARCH */
.lsl254-controlbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 18px 14px;background:transparent}.lsl254-sports{display:flex;align-items:center;gap:4px;min-width:0;overflow-x:auto;padding:4px;border:1px solid rgba(255,255,255,.055);border-radius:15px;background:rgba(5,8,15,.48);box-shadow:0 10px 30px rgba(0,0,0,.12);scrollbar-width:none}.lsl254-sports::-webkit-scrollbar{display:none}
.lsl254-sport{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;padding:9px 12px;border:0;border-radius:11px;background:transparent;color:#8794aa;font-size:10px;font-weight:850;cursor:pointer;transition:transform .18s ease,color .18s ease,background .18s ease,box-shadow .18s ease}.lsl254-sport:hover{color:#fff;transform:translateY(-1px)}.lsl254-sport.active{color:#fff;background:linear-gradient(135deg,rgba(217,70,239,.22),rgba(139,92,246,.13));box-shadow:0 8px 22px rgba(217,70,239,.10),0 0 0 1px rgba(217,70,239,.20) inset}.lsl254-sport-icon{font-size:13px;opacity:.95}
.lsl254-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;flex:1}
.lsl254-search{position:relative;display:flex;align-items:center;width:min(390px,40vw);min-width:235px;height:46px;padding:0 8px;border:1px solid rgba(217,70,239,.16);border-radius:16px;background:linear-gradient(135deg,rgba(14,18,34,.96),rgba(8,11,22,.96));box-shadow:0 10px 30px rgba(0,0,0,.16),0 0 0 1px rgba(255,255,255,.018) inset;overflow:hidden;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}.lsl254-search:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 16% 0%,rgba(217,70,239,.10),transparent 38%)}.lsl254-search:focus-within{border-color:rgba(217,70,239,.46);box-shadow:0 0 0 3px rgba(217,70,239,.08),0 14px 34px rgba(0,0,0,.20),0 0 22px rgba(217,70,239,.08);transform:translateY(-1px)}
.lsl254-search-icon{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:36px;flex:0 0 36px;color:#a7b2c7}.lsl254-search-icon svg{display:block;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.lsl254-search-input{position:relative;z-index:1;display:block;width:100%!important;min-width:0!important;height:44px!important;min-height:0!important;margin:0!important;padding:0 12px 0 8px!important;border:0!important;border-radius:0!important;outline:0!important;background:#0a0d16!important;background-color:#0a0d16!important;background-image:none!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif!important;font-size:11px!important;font-weight:760!important;line-height:44px!important;box-shadow:none!important;appearance:none!important;-webkit-appearance:none!important}.lsl254-search-input:focus{outline:0!important;border:0!important;background:#0a0d16!important;background-color:#0a0d16!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;box-shadow:none!important}.lsl254-search-input::placeholder{color:#9aa6bc!important;opacity:1}.lsl254-search-input::-webkit-search-decoration,.lsl254-search-input::-webkit-search-cancel-button,.lsl254-search-input::-webkit-search-results-button,.lsl254-search-input::-webkit-search-results-decoration{display:none!important}.lsl254-search-input:-webkit-autofill,.lsl254-search-input:-webkit-autofill:hover,.lsl254-search-input:-webkit-autofill:focus{border:0!important;-webkit-text-fill-color:#ffffff!important;-webkit-box-shadow:0 0 0 1000px #0a0d16 inset!important;box-shadow:0 0 0 1000px #0a0d16 inset!important;caret-color:#ffffff!important}
.lsl254-search-shortcut{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;margin-right:4px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(255,255,255,.035);color:#667389;font-size:9px;font-weight:900}.lsl254-search.has-value .lsl254-search-shortcut{display:none}.lsl254-search-clear{position:relative;z-index:1;display:none;align-items:center;justify-content:center;flex:0 0 28px;width:28px;height:28px;margin-right:2px;border:0;border-radius:9px;background:rgba(255,255,255,.035);color:#8b97ab;font-size:16px;line-height:1;cursor:pointer;transition:.16s ease}.lsl254-search.has-value .lsl254-search-clear{display:flex}.lsl254-search-clear:hover{background:rgba(217,70,239,.11);color:#fff}
.lsl254-filters{display:flex;align-items:center;gap:5px;flex:0 0 auto;padding:4px;border:1px solid rgba(255,255,255,.055);border-radius:14px;background:rgba(5,8,15,.44)}.lsl254-filter{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:0;border-radius:10px;background:transparent;color:#8f9bb0;font-size:10px;font-weight:900;cursor:pointer;transition:.16s ease}.lsl254-filter:hover{color:#fff}.lsl254-filter.active{background:rgba(217,70,239,.14);color:#fff;box-shadow:0 0 0 1px rgba(217,70,239,.20) inset}.lsl254-live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--danger);box-shadow:0 0 8px rgba(255,56,87,.55);animation:lsl254Pulse 1.15s infinite}@keyframes lsl254Pulse{0%,100%{opacity:1}50%{opacity:.28}}
/* MAIN */
.lsl254-scoreboard{background:transparent}.lsl254-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 20px 10px;background:transparent}.lsl254-live-heading{display:flex;align-items:center;gap:10px;min-width:0}.lsl254-live-heading-icon{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border-radius:9px;background:linear-gradient(145deg,rgba(217,70,239,.16),rgba(139,92,246,.09));color:#ee7bff;font-size:11px;box-shadow:0 0 0 1px rgba(217,70,239,.12) inset}.lsl254-live-heading-text strong{display:block;color:#fff;font-size:14px;font-weight:950;line-height:1.25;letter-spacing:.12px}.lsl254-live-heading-text small{display:block;margin-top:2px;color:#6f7c92;font-size:9px;font-weight:700}.lsl254-live-count-badge{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:24px;padding:0 8px;border-radius:9px;background:linear-gradient(135deg,#ff3d5b,#df2747);color:#fff;font-size:10px;font-weight:950;box-shadow:0 8px 18px rgba(255,56,87,.13)}.lsl254-toolbar-summary{display:none!important}
/* LIST */
.lsl254-tablebox{width:100%;overflow-x:hidden;padding:0 0 14px;background:transparent}.lsl254-table{display:block;width:100%;min-width:0!important;margin:0!important;border-collapse:separate!important;border-spacing:0!important;background:transparent!important;color:var(--text)}.lsl254-table thead{display:none!important}.lsl254-table tbody{display:block;width:100%;padding:0 11px}.lsl254-table tbody tr{box-sizing:border-box}
/* COMPETITION */
.lsl254-group-row{display:block;width:100%;margin-top:9px}.lsl254-group-row:first-child{margin-top:2px}.lsl254-group-row td{display:block!important;width:100%!important;padding:0!important;border:0!important;background:transparent!important}.lsl254-group-cell{display:block!important}.lsl254-group-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:45px;margin:0 4px;padding:8px 12px;border:1px solid rgba(255,255,255,.065);border-radius:13px;background:linear-gradient(105deg,rgba(217,70,239,.11),rgba(139,92,246,.065) 42%,rgba(255,255,255,.025));box-shadow:0 8px 24px rgba(0,0,0,.11),inset 3px 0 0 rgba(217,70,239,.72);transition:transform .16s ease,border-color .16s ease,background .16s ease}.lsl254-group-bar:hover{transform:translateY(-1px);border-color:rgba(217,70,239,.18);background:linear-gradient(105deg,rgba(217,70,239,.14),rgba(139,92,246,.075) 42%,rgba(255,255,255,.03))}
.lsl254-group-main{display:flex;align-items:center;gap:9px;min-width:0}.lsl254-group-star{flex:0 0 auto;color:var(--gold);font-size:13px;line-height:1;filter:drop-shadow(0 0 7px rgba(245,199,90,.20))}.lsl254-group-visual{display:flex;align-items:center;justify-content:center;flex:0 0 25px;width:25px;height:25px;padding:2px;border-radius:8px;background:rgba(255,255,255,.045);overflow:hidden;color:#8c98ad;font-size:12px;box-shadow:0 0 0 1px rgba(255,255,255,.045) inset}.lsl254-group-visual img{display:block;width:100%;height:100%;object-fit:contain}.lsl254-group-info{min-width:0}.lsl254-group-titleline{display:flex;align-items:center;gap:0;min-width:0;flex-wrap:wrap;line-height:1.4}.lsl254-group-name{display:inline;color:#f3f5fb;font-size:11px;font-weight:900;white-space:nowrap}.lsl254-group-country-inline{display:inline;color:#8995a9;font-size:9.5px;font-weight:750;white-space:nowrap}.lsl254-group-country-inline:before{content:" · ";color:#596579;margin:0 3px}.lsl254-group-round{display:inline-flex;align-items:center;margin-left:8px;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.05);color:#9ba6b9;font-size:8px;font-weight:850;white-space:nowrap;box-shadow:0 0 0 1px rgba(255,255,255,.045) inset}.lsl254-group-chevron{flex:0 0 auto;color:#707d91;font-size:12px;opacity:.72}
/* MATCH */
.lsl254-table tbody tr.lsl254-match-row{display:grid;grid-template-columns:118px minmax(0,.88fr) 70px minmax(0,1.12fr);align-items:center;gap:4px;width:calc(100% - 16px);margin:3px 8px 0;padding:0 10px 0 6px;border:1px solid transparent;border-radius:11px;background:rgba(255,255,255,.012);transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}.lsl254-table tbody tr.lsl254-match-row:hover{transform:translateY(-1px);background:rgba(255,255,255,.027);border-color:rgba(255,255,255,.055);box-shadow:0 8px 24px rgba(0,0,0,.10)}.lsl254-table tbody tr.is-live{background:linear-gradient(90deg,rgba(255,56,87,.055),rgba(255,255,255,.012) 48%,rgba(255,255,255,.012));border-color:rgba(255,56,87,.06)}.lsl254-table tbody tr.is-final{opacity:.88}.lsl254-table tbody tr.lsl254-match-row td{display:block;padding:10px 4px!important;border:0!important;background:transparent!important;color:#dfe5f0!important;font-size:11px;vertical-align:middle}
.lsl254-time-col{width:auto;white-space:nowrap}.lsl254-timebox{display:flex;align-items:center;gap:8px}.lsl254-fav-star{flex:0 0 auto;color:#6d7990;font-size:17px;line-height:1;transition:.15s ease}.lsl254-match-row:hover .lsl254-fav-star{color:#9aa6b9}.lsl254-time-copy{display:flex;flex-direction:column;gap:2px}.lsl254-time-main{color:#cdd5e4;font-size:10px;font-weight:900}.lsl254-time-sub{color:#69768c;font-size:8px;font-weight:800}.lsl254-live-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.lsl254-live-minute{color:#ff5b73;font-size:9px;font-weight:950;line-height:1;letter-spacing:.15px}.lsl254-live-label{display:inline-flex;align-items:center;gap:5px;color:#ff5b73;font-size:8px;font-weight:950;letter-spacing:.4px;text-transform:uppercase}.lsl254-live-label:before{content:"";width:5px;height:5px;border-radius:50%;background:var(--danger);box-shadow:0 0 7px rgba(255,56,87,.48)}.lsl254-match-minute{display:inline-flex;align-items:center;gap:5px;color:#ff5b73;font-size:9px;font-weight:950}.lsl254-match-minute:before{content:"";width:5px;height:5px;border-radius:50%;background:var(--danger);box-shadow:0 0 7px rgba(255,56,87,.48)}
.lsl254-table-team{display:flex;align-items:center;gap:8px;min-width:0}.lsl254-team-home{justify-content:flex-end;text-align:right}.lsl254-team-home .lsl254-team-text{text-align:right}.lsl254-team-away{justify-content:flex-start;text-align:left}.lsl254-mini-logo{display:flex;align-items:center;justify-content:center;flex:0 0 28px;width:28px;height:28px;border:0;border-radius:0;background:transparent;color:#8d99ad;font-size:8px;font-weight:900;overflow:visible}.lsl254-mini-logo img{display:block;width:27px;height:27px;object-fit:contain;filter:drop-shadow(0 3px 4px rgba(0,0,0,.26))}.lsl254-team-text{min-width:0}.lsl254-team-main{display:block;color:#f0f3f9;font-size:11px;font-weight:850;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .15s ease}.lsl254-match-row:hover .lsl254-team-main{color:#fff}.lsl254-comp{display:none!important}.lsl254-score-wrap{text-align:center;width:auto}.lsl254-score{display:inline-flex;align-items:center;justify-content:center;min-width:48px;padding:3px 4px;border:0;border-radius:0;background:transparent;color:#c6cfdd!important;font-size:15px!important;font-weight:950!important;letter-spacing:.3px;white-space:nowrap}.lsl254-score.is-live-score,.lsl254-score.is-final-score{color:#ff4762!important}.lsl254-score.is-upcoming-score{color:#717e93!important;font-size:9px!important;font-weight:850!important;text-transform:uppercase}
.lsl254-message{display:block;width:100%}.lsl254-message td{display:block!important;width:calc(100% - 16px);margin:8px;padding:26px 14px!important;border:1px dashed rgba(255,255,255,.07)!important;border-radius:13px!important;background:rgba(255,255,255,.018)!important;color:#8794aa!important;text-align:center!important}.lsl254-runtime-hidden{display:none!important}.lsl254-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:2px;padding:10px 18px 12px;color:#59657a;font-size:8px}.lsl254-footer a{color:#a873b6;text-decoration:none}.lsl254-attribution{display:flex;justify-content:flex-end;padding:7px 18px 10px;color:#59657a;font-size:8px}.lsl254-attribution a{margin-left:3px;color:#9b6eb0;text-decoration:none}.lsl254-attribution a:hover{color:#d995ec}
@media(max-width:860px){.lsl254-brand-logo-final{width:158px;min-width:158px}.lsl254-brand-title strong{font-size:17px}.lsl254-table tbody tr.lsl254-match-row{grid-template-columns:102px minmax(0,.9fr) 58px minmax(0,1.1fr)}}
@media(max-width:680px){
	.lsl254{margin:8px auto}.lsl254-shell{border-radius:17px}.lsl254-topbar{align-items:flex-start;flex-direction:column;padding:14px 13px 10px;gap:10px}.lsl254-brand-lockup{width:100%}.lsl254-brand-logo-final{width:145px;min-width:145px;height:42px}.lsl254-brand-logo-final img{max-height:42px}.lsl254-brand-title strong{font-size:15px}.lsl254-brand-title span{font-size:8px}.lsl254-top-date{align-self:flex-start;font-size:9px;padding:7px 10px}.lsl254-controlbar{align-items:flex-start;flex-direction:column;padding:0 10px 10px}.lsl254-sports{width:100%;border-radius:13px}.lsl254-sport{padding:8px 10px;font-size:9px}.lsl254-filters{align-self:flex-end}.lsl254-toolbar{padding:9px 13px}.lsl254-live-heading-text strong{font-size:12px}.lsl254-live-heading-text small{display:none}.lsl254-live-count-badge{height:22px;min-width:24px;font-size:9px}.lsl254-table tbody{padding:0 6px}.lsl254-group-bar{min-height:43px;margin:0 2px;padding:7px 9px;border-radius:11px}.lsl254-group-name{font-size:9.5px}.lsl254-group-country-inline{font-size:8.5px}.lsl254-group-round{font-size:7.5px;margin-left:5px;padding:2px 6px}.lsl254-group-star{font-size:11px}.lsl254-group-visual{width:22px;height:22px;flex-basis:22px;border-radius:7px}.lsl254-table tbody tr.lsl254-match-row{grid-template-columns:72px minmax(0,.9fr) 40px minmax(0,1.1fr);gap:2px;width:calc(100% - 8px);margin:3px 4px 0;padding:0 3px 0 1px;border-radius:9px}.lsl254-table tbody tr.lsl254-match-row td{padding:9px 2px!important}.lsl254-timebox{gap:4px}.lsl254-fav-star{font-size:13px}.lsl254-time-main{font-size:8.5px}.lsl254-time-sub,.lsl254-match-minute,.lsl254-live-minute,.lsl254-live-label{font-size:7px}.lsl254-mini-logo{width:22px;height:22px;flex-basis:22px}.lsl254-mini-logo img{width:21px;height:21px}.lsl254-team-main{font-size:8.6px;white-space:normal;line-height:1.2}.lsl254-table-team{gap:3px}.lsl254-score{min-width:34px;font-size:11px!important;padding:1px}.lsl254-score.is-upcoming-score{font-size:7.5px!important}.lsl254-footer{padding-left:12px;padding-right:12px}
}
@media(max-width:430px){.lsl254-brand-title span{display:none}.lsl254-brand-logo-final{width:134px;min-width:134px}.lsl254-table tbody tr.lsl254-match-row{grid-template-columns:60px minmax(0,.9fr) 34px minmax(0,1.1fr)}.lsl254-fav-star{display:none}.lsl254-timebox{gap:0}.lsl254-time-main{font-size:8px}.lsl254-team-main{font-size:8.1px}.lsl254-mini-logo{width:20px;height:20px;flex-basis:20px}.lsl254-mini-logo img{width:19px;height:19px}}

@media(max-width:980px){.lsl254-hero{grid-template-columns:190px minmax(0,1fr)}.lsl254-hero-cta{grid-column:1/-1;justify-self:end;flex-direction:row;align-items:center}.lsl254-controlbar{align-items:stretch;flex-direction:column}.lsl254-tools{width:100%;justify-content:space-between}.lsl254-search{width:100%;flex:1}.lsl254-filters{flex:0 0 auto}}
@media(max-width:680px){.lsl254-hero{grid-template-columns:1fr;margin:10px 10px 8px;padding:15px;border-radius:17px}.lsl254-hero-logo{height:104px;justify-content:center;padding:8px 14px}.lsl254-hero-logo img{max-height:76px;max-width:210px;transform:scale(1.55)}.lsl254-hero-logo-link:hover img{transform:scale(1.62)}.lsl254-hero-title{font-size:31px}.lsl254-hero-sub{font-size:10px}.lsl254-hero-cta{grid-column:auto;justify-self:stretch;align-items:stretch;flex-direction:column;min-width:0}.lsl254-hero-cta-label{display:none}.lsl254-hero-cta-btn{width:100%;min-height:44px}.lsl254-statusbar{margin:0 10px 8px;padding:9px 11px}.lsl254-statusbar-note{display:none}.lsl254-ticker{margin:0 10px 9px}.lsl254-controlbar{padding:0 10px 10px}.lsl254-tools{align-items:stretch;flex-direction:column}.lsl254-search{width:100%;min-width:0}.lsl254-filters{align-self:flex-end}.lsl254-ticker-track{animation-duration:22s}}

/* =========================================================
 * HYBRID UI 2026
 * Fondasi visual LINETOGEL dipertahankan.
 * Area pertandingan diubah menjadi premium match-card grid.
 * ========================================================= */
.lsl254-controlbar{flex-direction:column;align-items:stretch;gap:9px}
.lsl254-tools{order:1;width:100%;justify-content:space-between}
.lsl254-search{width:auto;min-width:0;flex:1}
.lsl254-sports{order:2;width:100%;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));overflow:visible}
.lsl254-sport{justify-content:center;min-height:46px;position:relative}
.lsl254-sport.active:after{content:"";position:absolute;left:20%;right:20%;bottom:-4px;height:2px;border-radius:99px;background:linear-gradient(90deg,transparent,var(--accent),#f08cff,var(--accent),transparent);box-shadow:0 0 14px rgba(217,70,239,.72)}

.lsl254-scoreboard{margin:0 18px 17px;border:1px solid rgba(255,255,255,.06);border-radius:19px;background:linear-gradient(180deg,rgba(6,9,17,.50),rgba(5,8,15,.28));overflow:hidden;box-shadow:0 18px 42px rgba(0,0,0,.13)}
.lsl254-toolbar{padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,.045)}
.lsl254-tablebox{padding:0;background:transparent}
.lsl254-table tbody{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:100%;padding:12px 14px 16px!important}

.lsl254-group-row{grid-column:1/-1!important;display:block!important;width:100%!important;margin:4px 0 0!important}
.lsl254-group-row:first-child{margin-top:0!important}
.lsl254-group-row td{width:100%!important}
.lsl254-group-bar{min-height:48px;margin:0!important;padding:9px 12px!important;border-color:rgba(217,70,239,.14);background:linear-gradient(90deg,rgba(217,70,239,.13),rgba(139,92,246,.07) 48%,rgba(255,255,255,.018));box-shadow:inset 3px 0 0 var(--accent),0 8px 24px rgba(0,0,0,.10)}
.lsl254-group-meta{display:flex;align-items:center;gap:10px;flex:0 0 auto}
.lsl254-group-count{display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:0 8px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:rgba(255,255,255,.035);color:#8e9bb1;font-size:7.5px;font-weight:950;letter-spacing:.55px;white-space:nowrap}

.lsl254-table tbody tr.lsl254-match-row{display:grid!important;grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr)!important;grid-template-rows:auto minmax(108px,1fr);grid-template-areas:"meta meta meta" "home score away";align-items:center;gap:0 8px;width:100%!important;min-width:0;margin:0!important;padding:12px 13px 14px!important;border:1px solid rgba(255,255,255,.07)!important;border-radius:17px!important;background:radial-gradient(circle at 50% -15%,rgba(217,70,239,.08),transparent 43%),linear-gradient(155deg,rgba(16,21,36,.92),rgba(8,11,21,.96))!important;box-shadow:0 11px 28px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.025);overflow:hidden;position:relative;opacity:1!important;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease}
.lsl254-table tbody tr.lsl254-match-row:before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(217,70,239,.34),transparent);opacity:.7;pointer-events:none}
.lsl254-table tbody tr.lsl254-match-row:hover{transform:translateY(-4px)!important;border-color:rgba(217,70,239,.26)!important;background:radial-gradient(circle at 50% -15%,rgba(217,70,239,.13),transparent 44%),linear-gradient(155deg,rgba(18,24,41,.97),rgba(8,11,21,.99))!important;box-shadow:0 18px 36px rgba(0,0,0,.24),0 0 24px rgba(217,70,239,.08)!important}
.lsl254-table tbody tr.lsl254-match-row.is-live{border-color:rgba(255,61,91,.34)!important;background:radial-gradient(circle at 50% -10%,rgba(255,61,91,.10),transparent 42%),linear-gradient(155deg,rgba(23,18,33,.96),rgba(10,11,21,.98))!important;box-shadow:0 14px 32px rgba(0,0,0,.22),0 0 0 1px rgba(255,61,91,.055) inset,0 0 20px rgba(255,61,91,.055);animation:lsl254LiveCard 2.6s ease-in-out infinite}
@keyframes lsl254LiveCard{0%,100%{box-shadow:0 14px 32px rgba(0,0,0,.22),0 0 0 1px rgba(255,61,91,.045) inset,0 0 14px rgba(255,61,91,.035)}50%{box-shadow:0 14px 32px rgba(0,0,0,.24),0 0 0 1px rgba(255,61,91,.11) inset,0 0 28px rgba(255,61,91,.11)}}

.lsl254-table tbody tr.lsl254-match-row td{padding:0!important;border:0!important;background:transparent!important;min-width:0}
.lsl254-table tbody tr.lsl254-match-row td:nth-child(1){grid-area:meta;padding-bottom:10px!important;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.055)!important}
.lsl254-table tbody tr.lsl254-match-row td:nth-child(2){grid-area:home}
.lsl254-table tbody tr.lsl254-match-row td:nth-child(3){grid-area:score}
.lsl254-table tbody tr.lsl254-match-row td:nth-child(4){grid-area:away}

.lsl254-timebox{width:100%;gap:0}.lsl254-fav-star{display:none!important}
.lsl254-time-copy{width:100%;display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:8px}
.lsl254-time-main{color:#8f9bb0;font-size:8.5px;font-weight:900;letter-spacing:.25px}
.lsl254-time-sub{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:0 8px;border:1px solid rgba(255,255,255,.055);border-radius:7px;background:rgba(255,255,255,.03);color:#8794aa;font-size:7.5px;font-weight:950;text-transform:uppercase;letter-spacing:.35px}
.lsl254-live-meta{display:inline-flex;align-items:center;gap:5px;min-height:23px;padding:0 8px;border:1px solid rgba(255,61,91,.20);border-radius:8px;background:rgba(255,61,91,.075);box-shadow:0 0 15px rgba(255,61,91,.045)}
.lsl254-live-minute,.lsl254-live-label{color:#ff5570!important;font-size:8px!important;font-weight:950}.lsl254-live-label:before{width:5px;height:5px;animation:lsl254Pulse 1.15s infinite}

.lsl254-table-team{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;gap:8px!important;text-align:center!important;min-width:0}
.lsl254-team-home{flex-direction:column-reverse!important}.lsl254-team-home .lsl254-team-text{text-align:center!important}.lsl254-team-away .lsl254-team-text{text-align:center!important}
.lsl254-mini-logo{width:48px!important;height:48px!important;flex:0 0 48px!important;padding:3px!important;border-radius:14px!important;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))!important;box-shadow:0 0 0 1px rgba(255,255,255,.055) inset,0 8px 20px rgba(0,0,0,.14)}
.lsl254-mini-logo img{width:39px!important;height:39px!important;filter:drop-shadow(0 5px 6px rgba(0,0,0,.32))!important}
.lsl254-team-main{max-width:100%;color:#f4f6fb!important;font-size:11.5px!important;font-weight:900!important;line-height:1.22!important;white-space:normal!important;text-align:center!important;overflow-wrap:anywhere}
.lsl254-score-wrap{text-align:center!important}
.lsl254-score{min-width:70px!important;min-height:48px;padding:0 7px!important;border:1px solid rgba(255,255,255,.055)!important;border-radius:13px!important;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.016))!important;color:#f5f7fc!important;font-size:24px!important;font-weight:950!important;letter-spacing:-.6px!important;box-shadow:0 8px 20px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.025)}
.lsl254-score.is-live-score{border-color:rgba(255,61,91,.15)!important;background:linear-gradient(145deg,rgba(255,61,91,.11),rgba(255,61,91,.025))!important;color:#ff5a74!important;text-shadow:0 0 16px rgba(255,61,91,.19)}
.lsl254-score.is-final-score{color:#e6eaf1!important}.lsl254-score.is-upcoming-score{color:#8d99ad!important;font-size:11px!important;letter-spacing:1px!important;text-transform:uppercase}

.lsl254-message{grid-column:1/-1!important}.lsl254-message td{width:100%!important;margin:0!important}
.lsl254-wib-clock{color:#d4a8de!important;font-variant-numeric:tabular-nums}

@media(max-width:980px){
 .lsl254-table tbody{grid-template-columns:repeat(2,minmax(0,1fr))}
 .lsl254-sports{grid-template-columns:repeat(5,minmax(135px,1fr));overflow-x:auto;scrollbar-width:none}
 .lsl254-sports::-webkit-scrollbar{display:none}
}
@media(max-width:680px){
 .lsl254-scoreboard{margin:0 10px 11px;border-radius:15px}
 .lsl254-table tbody{grid-template-columns:1fr;padding:9px!important;gap:9px}
 .lsl254-table tbody tr.lsl254-match-row{grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr)!important;grid-template-rows:auto minmax(96px,1fr);padding:11px!important;border-radius:14px!important}
 .lsl254-mini-logo{width:42px!important;height:42px!important;flex-basis:42px!important}.lsl254-mini-logo img{width:34px!important;height:34px!important}
 .lsl254-score{min-width:62px!important;min-height:44px;font-size:20px!important}.lsl254-team-main{font-size:10.5px!important}
 .lsl254-tools{flex-direction:row!important;align-items:center!important}.lsl254-search{flex:1}.lsl254-filters{align-self:auto!important}
 .lsl254-sports{grid-template-columns:repeat(5,minmax(120px,1fr))}
}
@media(max-width:460px){
 .lsl254-tools{flex-direction:column!important;align-items:stretch!important}.lsl254-filters{align-self:flex-end!important}
 .lsl254-table tbody tr.lsl254-match-row{grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr)!important;gap:0 5px}
 .lsl254-score{min-width:56px!important;font-size:18px!important}.lsl254-team-main{font-size:9.8px!important}
 .lsl254-group-country-inline{display:none}.lsl254-group-count{font-size:7px;padding:0 6px}
}
@media(prefers-reduced-motion:reduce){.lsl254-table tbody tr.lsl254-match-row.is-live{animation:none!important}}



/* =========================================================
 * HEADER LOCK — mengikuti konsep original pengguna
 * Jangan ubah layout ini saat mengembangkan area pertandingan.
 * ========================================================= */
.lsl254 .lsl254-hero{
	position:relative;
	display:grid;
	grid-template-columns:230px minmax(0,1fr) 185px;
	align-items:center;
	gap:28px;
	min-height:170px;
	margin:5px 5px 14px;
	padding:22px 20px;
	border:1px solid rgba(120,78,165,.20);
	border-radius:22px;
	background:
		radial-gradient(circle at 88% 35%,rgba(217,70,239,.11),transparent 31%),
		linear-gradient(105deg,#0b1426 0%,#0d1424 27%,#171226 55%,#35143e 100%);
	box-shadow:
		inset 0 1px 0 rgba(255,255,255,.025),
		0 12px 30px rgba(0,0,0,.18);
	overflow:hidden;
}
.lsl254 .lsl254-hero:after{
	content:"";
	position:absolute;
	inset:auto -70px -135px auto;
	width:330px;
	height:330px;
	border-radius:50%;
	background:radial-gradient(circle,rgba(215,61,232,.12),transparent 68%);
	pointer-events:none;
}
.lsl254 .lsl254-hero-logo{
	position:relative;
	z-index:1;
	display:flex;
	align-items:center;
	justify-content:center;
	width:230px;
	height:129px;
	padding:14px;
	border:0;
	border-radius:19px;
	background:#050910;
	box-shadow:0 14px 28px rgba(0,0,0,.28);
}
.lsl254 .lsl254-hero-logo-link{
	display:flex;
	align-items:center;
	justify-content:center;
	width:100%;
	height:100%;
	border-radius:15px;
	overflow:hidden;
}
.lsl254 .lsl254-hero-logo img{
	display:block;
	width:auto;
	height:auto;
	max-width:184px;
	max-height:83px;
	object-fit:contain;
	transform:none;
	filter:drop-shadow(0 5px 10px rgba(0,0,0,.50));
}
.lsl254 .lsl254-hero-logo-link:hover img{
	transform:scale(1.025);
	filter:drop-shadow(0 7px 14px rgba(0,0,0,.55));
}
.lsl254 .lsl254-hero-copy{
	position:relative;
	z-index:1;
	min-width:0;
	text-align:center;
}
.lsl254 .lsl254-kicker{
	display:flex;
	align-items:center;
	justify-content:center;
	gap:10px;
	margin:0 0 8px;
	color:#f4c94f;
	font-size:10px;
	font-weight:950;
	letter-spacing:1.15px;
	line-height:1;
	text-transform:uppercase;
}
.lsl254 .lsl254-kicker:before,
.lsl254 .lsl254-kicker:after{
	content:"";
	display:block;
	width:22px;
	height:1px;
	border-radius:99px;
	background:linear-gradient(90deg,transparent,#d5a832);
	box-shadow:none;
}
.lsl254 .lsl254-kicker:after{
	background:linear-gradient(90deg,#d5a832,transparent);
}
.lsl254 .lsl254-hero-title{
	margin:0;
	color:#f8f8fb;
	font-family:Georgia,"Times New Roman",serif;
	font-size:48px;
	font-weight:950;
	line-height:.98;
	letter-spacing:-1.8px;
	text-align:center;
	text-shadow:
		0 2px 0 rgba(255,255,255,.15),
		0 0 9px rgba(255,255,255,.35),
		0 5px 8px rgba(0,0,0,.55);
}
.lsl254 .lsl254-hero-title span{
	color:#d74be9;
	background:linear-gradient(180deg,#ee7aff 0%,#d54be7 48%,#a72dc1 100%);
	-webkit-background-clip:text;
	background-clip:text;
	-webkit-text-fill-color:transparent;
	text-shadow:
		0 0 9px rgba(222,76,241,.58),
		0 0 19px rgba(188,53,211,.32);
}
.lsl254 .lsl254-hero-sub{
	max-width:710px;
	margin:13px auto 0;
	color:#f1f4fb;
	font-size:12px;
	font-weight:700;
	line-height:1.6;
	text-align:center;
}
.lsl254 .lsl254-hero-cta{
	position:relative;
	z-index:1;
	display:flex;
	align-items:center;
	justify-content:center;
	min-width:185px;
	align-self:center;
}
.lsl254 .lsl254-hero-cta-label{display:none!important}
.lsl254 .lsl254-hero-cta-btn{
	display:inline-flex;
	align-items:center;
	justify-content:center;
	gap:5px;
	width:158px;
	min-height:48px;
	padding:0 13px;
	border:1px solid rgba(219,161,76,.45);
	border-radius:14px;
	background:linear-gradient(135deg,rgba(116,65,81,.90),rgba(93,38,104,.92));
	color:#fff!important;
	font-size:10px;
	font-weight:950;
	letter-spacing:0;
	text-decoration:none!important;
	box-shadow:none;
	white-space:nowrap;
}
.lsl254 .lsl254-hero-cta-btn:hover{
	transform:translateY(-1px);
	border-color:rgba(239,187,100,.72);
	box-shadow:0 8px 18px rgba(0,0,0,.15);
}
.lsl254 .lsl254-hero-cta-arrow{
	display:inline;
	width:auto;
	height:auto;
	border:0;
	border-radius:0;
	background:transparent;
	font-size:12px;
	line-height:1;
}
@media(max-width:980px){
	.lsl254 .lsl254-hero{
		grid-template-columns:190px minmax(0,1fr) 155px;
		gap:18px;
		padding:19px 17px;
	}
	.lsl254 .lsl254-hero-logo{
		width:190px;
		height:116px;
	}
	.lsl254 .lsl254-hero-title{font-size:42px}
	.lsl254 .lsl254-hero-sub{font-size:11px}
	.lsl254 .lsl254-hero-cta{min-width:155px}
	.lsl254 .lsl254-hero-cta-btn{width:148px}
}
@media(max-width:760px){
	.lsl254 .lsl254-hero{
		grid-template-columns:1fr;
		min-height:0;
		margin:6px 6px 10px;
		padding:16px;
		gap:15px;
	}
	.lsl254 .lsl254-hero-logo{
		width:100%;
		max-width:230px;
		height:105px;
		justify-self:center;
	}
	.lsl254 .lsl254-hero-title{font-size:36px}
	.lsl254 .lsl254-hero-sub{
		max-width:520px;
		margin-top:10px;
		font-size:10.5px;
	}
	.lsl254 .lsl254-hero-cta{
		width:100%;
		min-width:0;
	}
	.lsl254 .lsl254-hero-cta-btn{
		width:min(100%,260px);
	}
}


/* SEARCH FINAL OVERRIDE: hitam saat normal/focus, teks putih. */
.lsl254 .lsl254-tools .lsl254-search{background:#070a12!important;background-image:none!important}
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"],
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"]:hover,
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"]:focus,
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"]:active{
background:#070a12!important;background-color:#070a12!important;background-image:none!important;color:#fff!important;-webkit-text-fill-color:#fff!important;caret-color:#fff!important;border:0!important;outline:0!important;box-shadow:none!important}
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"]::placeholder{color:#fff!important;opacity:.72!important}
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"]:-webkit-autofill,
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"]:-webkit-autofill:hover,
.lsl254 .lsl254-tools .lsl254-search input.lsl254-search-input[type="search"]:-webkit-autofill:focus{-webkit-text-fill-color:#fff!important;-webkit-box-shadow:0 0 0 1000px #070a12 inset!important;box-shadow:0 0 0 1000px #070a12 inset!important;caret-color:#fff!important}

</style>
			<?php
		}

		?>

<div
	id="<?php echo esc_attr( $id ); ?>"
	class="lsl254"
	style="<?php echo esc_attr( '--accent:' . $settings['accent_color'] . ';' ); ?>"
>
	<div class="lsl254-shell">
		<div class="lsl254-hero">
			<div class="lsl254-hero-logo">
				<a class="lsl254-hero-logo-link" href="<?php echo esc_url( $settings['direct_url'] ); ?>" target="_blank" rel="noopener noreferrer nofollow" aria-label="Kunjungi LINETOGEL">
					<img src="<?php echo esc_url( $settings['logo_url'] ); ?>" alt="<?php echo esc_attr( $settings['brand_name'] ); ?>">
				</a>
			</div>
			<div class="lsl254-hero-copy">
				<div class="lsl254-kicker">REAL MATCHES • REAL MOMENTS</div>
				<h2 class="lsl254-hero-title">LIVE <span>SCORE</span></h2>
				<p class="lsl254-hero-sub">Semua pertandingan olahraga favorit dalam satu halaman. Pantau jadwal, skor terbaru, dan update pertandingan dengan cepat, praktis, dan mudah.</p>
			</div>
			<div class="lsl254-hero-cta">
				<a class="lsl254-hero-cta-btn" href="<?php echo esc_url( $settings['direct_url'] ); ?>" target="_blank" rel="noopener noreferrer nofollow">
					<span>KUNJUNGI LINETOGEL</span><span class="lsl254-hero-cta-arrow">→</span>
				</a>
			</div>
		</div>

		<div class="lsl254-statusbar">
			<div class="lsl254-statusbar-main"><span class="lsl254-status-dot"></span><strong>Live Score Hari Ini</strong><span class="lsl254-toolbar-date"><?php echo esc_html( $this->today_label() ); ?></span></div>
			<div class="lsl254-statusbar-note">Today • Semua waktu mengikuti WIB • <span class="lsl254-wib-clock">--:--:-- WIB</span></div>
		</div>

		<div class="lsl254-ticker">
			<div class="lsl254-ticker-label">LIVE TICKER</div>
			<div class="lsl254-ticker-window"><div class="lsl254-ticker-track">Memuat pertandingan Today LINETOGEL...</div></div>
		</div>

		<div class="lsl254-controlbar">
			<div class="lsl254-sports">
				<?php
				$sport_icons = array('football'=>'⚽','hockey'=>'🏒','basketball'=>'🏀','tennis'=>'🎾','cricket'=>'🏏');
				foreach ( self::$sports as $key => $label ) : ?>
					<button type="button" class="lsl254-sport <?php echo $key === $initial_sport ? 'active' : ''; ?>" data-sport="<?php echo esc_attr( $key ); ?>">
						<span class="lsl254-sport-icon"><?php echo esc_html( $sport_icons[ $key ] ); ?></span><span><?php echo esc_html( $label ); ?></span>
					</button>
				<?php endforeach; ?>
			</div>
			<div class="lsl254-tools">
				<label class="lsl254-search">
					<span class="lsl254-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.6-3.6"></path></svg></span>
					<input type="search" class="lsl254-search-input" placeholder="Cari tim, liga, negara atau round..." autocomplete="off" aria-label="Cari pertandingan">
					<span class="lsl254-search-shortcut" aria-hidden="true">/</span>
					<button type="button" class="lsl254-search-clear" aria-label="Hapus pencarian">×</button>
				</label>
				<div class="lsl254-filters">
					<button type="button" class="lsl254-filter active" data-filter="all">Semua</button>
					<button type="button" class="lsl254-filter" data-filter="live"><span class="lsl254-live-dot"></span> LIVE</button>
				</div>
			</div>
		</div>

		<div class="lsl254-scoreboard">
			<div class="lsl254-toolbar">
				<div class="lsl254-live-heading">
					<span class="lsl254-live-heading-icon">◉</span>
					<div class="lsl254-live-heading-text"><strong>LIVE <span class="lsl254-current-sport">FOOTBALL</span> MATCHES</strong><small>Daftar Today • LIVE, Upcoming & Finished</small></div>
					<span class="lsl254-live-count-badge lsl254-live-count">0</span>
				</div>
				<div class="lsl254-toolbar-summary">
					<span class="lsl254-summary-chip">PERTANDINGAN <b class="lsl254-match-stat">—</b></span>
					<span class="lsl254-summary-chip">LIGA <b class="lsl254-league-stat">—</b></span>
					<span class="lsl254-summary-chip"><b class="lsl254-toolbar-date"><?php echo esc_html( $this->today_label() ); ?></b></span>
				</div>
			</div>
			<div class="lsl254-tablebox">
				<table class="lsl254-table">
					<thead><tr><th>Waktu</th><th>Tim Tuan Rumah</th><th>Skor</th><th>Tim Tamu</th></tr></thead>
					<tbody class="lsl254-body"><tr class="lsl254-message"><td colspan="4">Memuat live score...</td></tr></tbody>
				</table>
			</div>
		</div>

		<div class="lsl254-attribution">Powered by <a href="https://sportscore.com/" target="_blank" rel="noopener">SportScore</a></div>

		<div class="lsl254-runtime-hidden" aria-hidden="true"><div class="lsl254-featured"></div><span class="lsl254-live-stat">0</span><span class="lsl254-updated"></span></div>
	</div>
</div>
<script>
(function(config){

	'use strict';

	function boot(){

		const root =
			document.getElementById(
				config.id
			);

		if(!root){
			return;
		}

		const tbody =
			root.querySelector(
				'.lsl254-body'
			);

		const featured =
			root.querySelector(
				'.lsl254-featured'
			);

		const matchStat =
			root.querySelector(
				'.lsl254-match-stat'
			);

		const leagueStat =
			root.querySelector(
				'.lsl254-league-stat'
			);

		const liveCount =
			root.querySelector(
				'.lsl254-live-count'
			);

		const liveStat =
			root.querySelector(
				'.lsl254-live-stat'
			);

		const updated =
			root.querySelector(
				'.lsl254-updated'
			);

		const dateValue =
			root.querySelector(
				'.lsl254-toolbar-date'
			);

		const toolbarDate =
			root.querySelector(
				'.lsl254-toolbar-date'
			);

		const sportButtons =
			root.querySelectorAll(
				'.lsl254-sport'
			);

		const filterButtons =
			root.querySelectorAll(
				'.lsl254-filter'
			);

		const currentSportLabel = root.querySelector('.lsl254-current-sport');
		const searchBox = root.querySelector('.lsl254-search');
		const searchInput = root.querySelector('.lsl254-search-input');
		const searchClear = root.querySelector('.lsl254-search-clear');
		const wibClock = root.querySelector('.lsl254-wib-clock');

		function updateWibClock(){
			if(!wibClock){ return; }
			try{
				const parts = new Intl.DateTimeFormat('id-ID',{
					timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
				}).format(new Date());
				wibClock.textContent = parts.replace(/\./g,':') + ' WIB';
			}catch(e){
				wibClock.textContent = '--:--:-- WIB';
			}
		}
		updateWibClock();
		setInterval(updateWibClock,1000);

		document.addEventListener('keydown', function(event){
			if(
				event.key === '/' &&
				searchInput &&
				document.activeElement !== searchInput &&
				!event.ctrlKey && !event.metaKey && !event.altKey
			){
				event.preventDefault();
				searchInput.focus();
			}
		});
		const tickerTrack = root.querySelector('.lsl254-ticker-track');

		let activeSport =
			config.sport;

		let activeFilter =
			'all';

		let searchQuery = '';

		let matches =
			[];

		let controller =
			null;

		let minuteController =
			null;

		let logoIndex =
			null;

		/**
		 * =====================================================
		 * SAFE DOM
		 * =====================================================
		 */

		function el(
			tag,
			className,
			text
		){

			const node =
				document.createElement(
					tag
				);

			if(className){
				node.className =
					className;
			}

			if(
				text !== undefined &&
				text !== null
			){

				node.textContent =
					String(text);
			}

			return node;
		}

		function safeUrl(value){

			if(!value){
				return '';
			}

			try{

				const url =
					new URL(
						String(value),
						window.location.href
					);

				if(
					url.protocol !== 'http:' &&
					url.protocol !== 'https:'
				){
					return '';
				}

				return url.href;

			}catch(error){

				return '';
			}
		}

		/**
		 * =====================================================
		 * LOGO DATABASE
		 * =====================================================
		 */

		function loadScript(url){

			return new Promise(
				function(resolve){

					const script =
						document.createElement(
							'script'
						);

					script.src =
						url;

					script.async =
						false;

					script.onload =
						function(){
							resolve(true);
						};

					script.onerror =
						function(){
							resolve(false);
						};

					document.head.appendChild(
						script
					);
				}
			);
		}

		function ensureLogoDb(){

			if(
				activeSport !==
					'football'
			){
				return Promise.resolve();
			}

			if(
				window.LSL254LogoLoaded
			){
				return Promise.resolve();
			}

			if(
				window.LSL254LogoPromise
			){
				return window.LSL254LogoPromise;
			}

			window.LOGO_DB =
				window.LOGO_DB || {};

			window.LSL254LogoPromise =
				(async function(){

					for(
						let i = 0;
						i <= 9;
						i++
					){

						await loadScript(
							config.logoBase +
							'logo-db-' +
							i +
							'.js'
						);
					}

					await loadScript(
						config.logoBase +
							'logo-db.js'
					);

					window.LSL254LogoLoaded =
						true;

					logoIndex =
						null;
				})();

			return window.LSL254LogoPromise;
		}

		function normalizeLogoName(name){

			if(!name){
				return '';
			}

			let value =
				String(name)
					.normalize('NFD')
					.replace(
						/[\u0300-\u036f]/g,
						''
					)
					.toLowerCase()
					.trim();

			value =
				value
					.replace(
						/[.'’_,\-]/g,
						' '
					)
					.replace(
						/\s+/g,
						' '
					)
					.trim();

			value =
				value
					.replace(
						/\b(fc|cf|afc|sc|ac|rc|cd|sd|ud|fk|sk|club)\b/g,
						' '
					)
					.replace(
						/\b(de|da|do|del|di|the)\b/g,
						' '
					)
					.replace(
						/\s+/g,
						' '
					)
					.trim();

			const aliases = {

				'man city':
					'manchester city',

				'man utd':
					'manchester united',

				'manchester utd':
					'manchester united',

				'internazionale':
					'inter',

				'internazionale milano':
					'inter',

				'inter milan':
					'inter',

				'paris saint germain':
					'psg',

				'paris st germain':
					'psg',

				'lask linz':
					'lask',

				'celta de vigo':
					'celta vigo',

				'real celta vigo':
					'celta vigo',

				'borussia dortmund':
					'dortmund',

				'lille osc':
					'lille',

				'real betis balompie':
					'real betis',

				'aek athina':
					'aek athens'
			};

			return aliases[value] ||
				value;
		}

		function buildLogoIndex(){

			if(
				logoIndex !== null
			){
				return logoIndex;
			}

			logoIndex =
				Object.create(null);

			if(
				typeof window.LOGO_DB ===
					'undefined' ||
				!window.LOGO_DB
			){

				return logoIndex;
			}

			Object.keys(
				window.LOGO_DB
			).forEach(
				function(key){

					const url =
						window.LOGO_DB[key];

					if(!url){
						return;
					}

					const original =
						String(key)
							.toLowerCase()
							.trim();

					const normalized =
						normalizeLogoName(
							key
						);

					if(
						original &&
						!logoIndex[original]
					){

						logoIndex[original] =
							url;
					}

					if(
						normalized &&
						!logoIndex[normalized]
					){

						logoIndex[normalized] =
							url;
					}
				}
			);

			return logoIndex;
		}

		function findDbLogo(name){

			if(
				activeSport !==
					'football'
			){
				return '';
			}

			const index =
				buildLogoIndex();

			const original =
				String(name || '')
					.toLowerCase()
					.trim();

			const normalized =
				normalizeLogoName(
					name
				);

			if(
				original &&
				index[original]
			){

				return safeUrl(
					index[original]
				);
			}

			if(
				normalized &&
				index[normalized]
			){

				return safeUrl(
					index[normalized]
				);
			}

			return '';
		}

		function resolveLogo(
			name,
			apiLogo
		){

			const provider =
				safeUrl(
					apiLogo
				);

			if(provider){
				return provider;
			}

			return findDbLogo(
				name
			);
		}

		function initials(name){

			if(!name){
				return '?';
			}

			const words =
				String(name)
					.trim()
					.split(/\s+/)
					.filter(Boolean);

			if(!words.length){
				return '?';
			}

			if(words.length === 1){

				return words[0]
					.substring(0,2)
					.toUpperCase();
			}

			return (
				words[0].charAt(0) +
				words[
					words.length - 1
				].charAt(0)
			).toUpperCase();
		}

		function createLogo(
			name,
			apiLogo,
			className
		){

			const box =
				el(
					'div',
					className
				);

			const logo =
				resolveLogo(
					name,
					apiLogo
				);

			if(logo){

				const img =
					document.createElement(
						'img'
					);

				img.src =
					logo;

				img.alt =
					name || '';

				img.loading =
					'lazy';

				img.decoding =
					'async';

				img.addEventListener(
					'error',
					function(){

						box.textContent =
							initials(
								name
							);
					},
					{
						once:true
					}
				);

				box.appendChild(
					img
				);

			}else{

				box.textContent =
					initials(
						name
					);
			}

			return box;
		}

		/**
		 * =====================================================
		 * COMMON
		 * =====================================================
		 */

		function competitionLabel(match){

			return (
				match.competition ||
				match.region ||
				'Match Day'
			);
		}

		function scoreDisplay(match){

			if(match.score && /\d/.test(String(match.score))){
				return String(match.score);
			}
			if(match.state === 'upcoming'){
				return 'vs';
			}
			return '—';
		}

		/**
		 * =====================================================
		 * FEATURED
		 * =====================================================
		 */

		function featuredWeight(match){

			let weight = 0;

			if(
				match.state ===
					'live'
			){
				weight += 1000;
			}

			if(
				match.state ===
					'upcoming'
			){
				weight += 300;
			}

			const competition =
				String(
					match.competition ||
					''
				).toLowerCase();

			[
				'champions league',
				'premier league',
				'la liga',
				'serie a',
				'bundesliga',
				'ligue 1',
				'europa league',
				'world cup',
				'libertadores'
			].forEach(
				function(name){

					if(
						competition.indexOf(
							name
						) !== -1
					){

						weight += 250;
					}
				}
			);

			return weight;
		}

		function renderFeatured(){

			featured.textContent =
				'';

			const items =
				matches
					.slice()
					.sort(
						function(a,b){

							return (
								featuredWeight(b) -
								featuredWeight(a)
							);
						}
					)
					.slice(
						0,
						Number(
							config.featured
						) || 4
					);

			if(
				!items.length
			){

				const card =
					el(
						'div',
						'lsl254-card'
					);

				card.appendChild(
					el(
						'div',
						'lsl254-card-league',
						'Belum ada pertandingan spesial.'
					)
				);

				featured.appendChild(
					card
				);

				return;
			}

			items.forEach(
				function(match){

					const card =
						el(
							'div',
							'lsl254-card'
						);

					let badge =
						'🔥 BIG MATCH';

					if(
						match.state ===
							'live'
					){

						badge =
							'🔥 LIVE MATCH';
					}

					if(
						match.state ===
							'final'
					){

						badge =
							'FINAL RESULT';
					}

					card.appendChild(
						el(
							'div',
							'lsl254-card-badge',
							badge
						)
					);

					card.appendChild(
						el(
							'div',
							'lsl254-card-league',
							competitionLabel(
								match
							)
						)
					);

					const body =
						el(
							'div',
							'lsl254-card-match'
						);

					const home =
						el(
							'div',
							'lsl254-card-team'
						);

					home.appendChild(
						createLogo(
							match.home,
							match.home_logo,
							'lsl254-big-logo'
						)
					);

					home.appendChild(
						el(
							'div',
							'lsl254-card-team-name',
							match.home || '-'
						)
					);

					const center =
						el(
							'div',
							'lsl254-card-vs'
						);

					if(
						match.state ===
							'live' ||
						match.state ===
							'final'
					){

						center.textContent =
							scoreDisplay(
								match
							);

					}else{

						center.textContent =
							'VS';
					}

					const away =
						el(
							'div',
							'lsl254-card-team'
						);

					away.appendChild(
						createLogo(
							match.away,
							match.away_logo,
							'lsl254-big-logo'
						)
					);

					away.appendChild(
						el(
							'div',
							'lsl254-card-team-name',
							match.away || '-'
						)
					);

					body.appendChild(
						home
					);

					body.appendChild(
						center
					);

					body.appendChild(
						away
					);

					card.appendChild(
						body
					);

					const footer =
						el(
							'div',
							'lsl254-card-footer'
						);

					footer.appendChild(
						el(
							'span',
							'',
							match.state ===
								'live'
									? '● LIVE'
									: (
										match.kickoff_wib
											? match.kickoff_wib + ' WIB'
											: '-'
									)
						)
					);

					footer.appendChild(
						el(
							'span',
							'',
							match.status || '-'
						)
					);

					card.appendChild(
						footer
					);

					featured.appendChild(
						card
					);
				}
			);
		}

		/**
		 * =====================================================
		 * SHADOWBOX TABLE
		 * =====================================================
		 */

		function showMessage(text){

			tbody.textContent =
				'';

			const row =
				el(
					'tr',
					'lsl254-message'
				);

			const cell =
				el(
					'td',
					'',
					text
				);

			cell.colSpan =
				4;

			row.appendChild(
				cell
			);

			tbody.appendChild(
				row
			);
		}

		function matchStatusTone(match){

			if(match.state === 'live'){
				return 'live';
			}

			if(
				match.status === 'Turun Minum' ||
				String(match.status || '').toUpperCase() === 'HT'
			){
				return 'ht';
			}

			if(match.state === 'final'){
				return 'ft';
			}

			if(match.state === 'upcoming'){
				return 'up';
			}

			return 'other';
		}

		function liveMatchKey(home,away){
			return normalizeSearch(home || '') + '||' + normalizeSearch(away || '');
		}

		function displayLiveMinute(value){
			let text = String(value || '').trim().toUpperCase();
			if(!text){ return ''; }
			if(text === 'HT'){ return 'HT'; }
			text = text.replace(/[’']/g,'');
			if(/^\d{1,3}(?:\+\d{1,2})?\+?$/.test(text)){
				return text;
			}
			return '';
		}

		function updateMinuteDom(){
			const lookup = Object.create(null);
			matches.forEach(function(match){
				if(match && match.state === 'live'){
					lookup[liveMatchKey(match.home,match.away)] = match;
				}
			});

			root.querySelectorAll('.lsl254-match-row[data-live-key]').forEach(function(row){
				const match = lookup[row.getAttribute('data-live-key') || ''];
				if(!match){ return; }
				const meta = row.querySelector('.lsl254-live-meta');
				if(!meta){ return; }
				const minuteText = displayLiveMinute(match.minute);
				let minuteNode = meta.querySelector('.lsl254-live-minute');
				if(minuteText){
					if(!minuteNode){
						minuteNode = el('span','lsl254-live-minute','');
						meta.insertBefore(minuteNode,meta.firstChild);
					}
					minuteNode.textContent = minuteText;
				}
			});
		}

		function createTimeCell(match){

			const td = document.createElement('td');
			td.className = 'lsl254-time-col';
			const box = el('div','lsl254-timebox');
			box.appendChild(el('span','lsl254-fav-star','☆'));
			const copy = el('div','lsl254-time-copy');
			copy.appendChild(el('div','lsl254-time-main', match.kickoff_wib ? match.kickoff_wib + ' WIB' : '—'));

			if(match.state === 'live'){
				const liveMeta = el('div','lsl254-live-meta');
				const minuteText = displayLiveMinute(match.minute);
				if(minuteText){
					liveMeta.appendChild(el('span','lsl254-live-minute',minuteText));
				}
				liveMeta.appendChild(el('span','lsl254-live-label','LIVE'));
				copy.appendChild(liveMeta);
			}else{
				let subtext = 'Jadwal';
				if(match.state === 'final'){
					subtext = 'Selesai';
				}else if(match.next_morning){
					subtext = 'Dini Hari';
				}else if(match.status){
					subtext = match.status;
				}
				copy.appendChild(el('div','lsl254-time-sub', subtext));
			}
			box.appendChild(copy);
			td.appendChild(box);
			return td;
		}

		function createTeamCell(
			name,
			competition,
			apiLogo,
			side
		){

			const td = document.createElement('td');

			const wrapper = el(
				'div',
				'lsl254-table-team ' + (side === 'home' ? 'lsl254-team-home' : 'lsl254-team-away')
			);

			const logo = createLogo(name, apiLogo, 'lsl254-mini-logo');

			const text = el('div','lsl254-team-text');
			text.appendChild(el('span','lsl254-team-main', name || '-'));

			if(competition){
				text.appendChild(el('span','lsl254-comp', competition));
			}

			if(side === 'home'){
				wrapper.appendChild(text);
				wrapper.appendChild(logo);
			}else{
				wrapper.appendChild(logo);
				wrapper.appendChild(text);
			}

			td.appendChild(wrapper);
			return td;
		}

		function createScoreCell(match){

			const td = document.createElement('td');
			td.className = 'lsl254-score-wrap';
			let scoreClass = 'lsl254-score';
			if(match.state === 'live'){ scoreClass += ' is-live-score'; }
			else if(match.state === 'final'){ scoreClass += ' is-final-score'; }
			else if(match.state === 'upcoming'){ scoreClass += ' is-upcoming-score'; }
			td.appendChild(el('span',scoreClass,scoreDisplay(match)));
			return td;
		}

		function createStatusCell(match){

			const td = document.createElement('td');
			td.className = 'lsl254-status-col';

			const wrap = el('div','lsl254-status-stack');
			const tone = matchStatusTone(match);
			let code = '-';
			let desc = match.status || '-';

			if(tone === 'live'){
				code = 'LIVE';
				desc = 'Sedang berlangsung';
			}else if(tone === 'ht'){
				code = 'HT';
				desc = 'Turun minum';
			}else if(tone === 'ft'){
				code = 'FT';
				desc = 'Final';
			}else if(tone === 'up'){
				code = 'UP';
				desc = match.kickoff_wib ? 'Belum mulai' : (match.status || 'Jadwal');
			}else if(match.status){
				code = match.status;
			}

			wrap.appendChild(el('span','lsl254-status-pill ' + tone, code));
			wrap.appendChild(el('span','lsl254-status-text', desc));
			td.appendChild(wrap);
			return td;
		}

		function countryCode(region, suppliedCode){
			const direct = String(suppliedCode || '').trim().toLowerCase();
			if(/^[a-z]{2}$/.test(direct)){
				return direct;
			}

			const key = String(region || '').toLowerCase().trim().replace(/\s+/g,' ');
			const codes = {
				'afghanistan':'af','albania':'al','algeria':'dz','andorra':'ad','angola':'ao','antigua and barbuda':'ag','argentina':'ar','armenia':'am','australia':'au','austria':'at','azerbaijan':'az',
				'bahrain':'bh','bangladesh':'bd','barbados':'bb','belarus':'by','belgium':'be','belize':'bz','benin':'bj','bermuda':'bm','bhutan':'bt','bolivia':'bo','bosnia and herzegovina':'ba','botswana':'bw','brazil':'br','brunei':'bn','bulgaria':'bg','burkina faso':'bf','burundi':'bi',
				'cambodia':'kh','cameroon':'cm','canada':'ca','cape verde':'cv','chile':'cl','china':'cn','colombia':'co','comoros':'km','congo':'cg','costa rica':'cr','croatia':'hr','cuba':'cu','curacao':'cw','cyprus':'cy','czech republic':'cz','czechia':'cz',
				'denmark':'dk','dominican republic':'do','ecuador':'ec','egypt':'eg','el salvador':'sv','england':'gb-eng','estonia':'ee','ethiopia':'et','finland':'fi','france':'fr','gabon':'ga','gambia':'gm','georgia':'ge','germany':'de','ghana':'gh','greece':'gr','grenada':'gd','guatemala':'gt','guinea':'gn','guyana':'gy',
				'haiti':'ht','honduras':'hn','hong kong':'hk','hungary':'hu','iceland':'is','india':'in','indonesia':'id','iran':'ir','iraq':'iq','ireland':'ie','israel':'il','italy':'it','ivory coast':'ci','cote d ivoire':'ci','jamaica':'jm','japan':'jp','jordan':'jo','kazakhstan':'kz','kenya':'ke','kosovo':'xk','kuwait':'kw','kyrgyzstan':'kg',
				'laos':'la','latvia':'lv','lebanon':'lb','libya':'ly','liechtenstein':'li','lithuania':'lt','luxembourg':'lu','malaysia':'my','maldives':'mv','mali':'ml','malta':'mt','mexico':'mx','moldova':'md','monaco':'mc','mongolia':'mn','montenegro':'me','morocco':'ma','mozambique':'mz','myanmar':'mm',
				'namibia':'na','nepal':'np','netherlands':'nl','new zealand':'nz','nicaragua':'ni','niger':'ne','nigeria':'ng','north macedonia':'mk','northern ireland':'gb-nir','norway':'no','oman':'om','pakistan':'pk','palestine':'ps','panama':'pa','paraguay':'py','peru':'pe','philippines':'ph','poland':'pl','portugal':'pt','puerto rico':'pr','qatar':'qa',
				'romania':'ro','russia':'ru','saudi arabia':'sa','scotland':'gb-sct','senegal':'sn','serbia':'rs','singapore':'sg','slovakia':'sk','slovenia':'si','south africa':'za','south korea':'kr','korea republic':'kr','spain':'es','sri lanka':'lk','sudan':'sd','suriname':'sr','sweden':'se','switzerland':'ch','syria':'sy',
				'taiwan':'tw','tajikistan':'tj','tanzania':'tz','thailand':'th','trinidad and tobago':'tt','tunisia':'tn','turkey':'tr','turkiye':'tr','turkmenistan':'tm','uganda':'ug','ukraine':'ua','united arab emirates':'ae','united states':'us','usa':'us','uruguay':'uy','uzbekistan':'uz','venezuela':'ve','vietnam':'vn','wales':'gb-wls','zambia':'zm','zimbabwe':'zw'
			};
			return codes[key] || '';
		}

		function createGroupVisual(match){
			const box = el('span','lsl254-group-visual');
			const competitionLogo = safeUrl(match && match.competition_logo ? match.competition_logo : '');
			const regionLogo = safeUrl(match && match.region_logo ? match.region_logo : '');
			const code = countryCode(match ? match.region : '', match ? match.region_code : '');

			/* Seperti acuan: logo kompetisi didahulukan, baru flag/region. */
			let url = competitionLogo || regionLogo || '';

			if(!url && code){
				url = 'https://flagcdn.com/w40/' + code + '.png';
			}

			if(url){
				const img = document.createElement('img');
				img.src = url;
				img.alt = match && match.region ? String(match.region) : 'Competition';
				img.loading = 'lazy';
				img.addEventListener('error',function(){
					box.textContent = '◉';
				},{once:true});
				box.appendChild(img);
			}else{
				box.textContent = '◉';
			}
			return box;
		}

		function normalizeSearch(value){
			return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
		}

		function matchSearchText(match){
			return normalizeSearch([
				match.home, match.away, match.competition, match.region, match.round, match.status
			].filter(Boolean).join(' '));
		}

		function updateTicker(){
			if(!tickerTrack){ return; }
			const live = matches.filter(function(m){ return m.state === 'live'; }).slice(0,6);
			const upcoming = matches.filter(function(m){ return m.state === 'upcoming'; }).slice(0,5);
			const items = [];
			live.forEach(function(m){
				items.push('● LIVE ' + (m.home || '-') + ' ' + scoreDisplay(m) + ' ' + (m.away || '-'));
			});
			upcoming.forEach(function(m){
				items.push((m.kickoff_wib ? m.kickoff_wib + ' WIB' : 'UPCOMING') + '  ' + (m.home || '-') + ' vs ' + (m.away || '-'));
			});
			if(!items.length){
				items.push('LINETOGEL • Tidak ada pertandingan Today yang tersedia saat ini');
			}
			tickerTrack.textContent = items.join('     ◆     ');
			tickerTrack.style.animation = 'none';
			void tickerTrack.offsetWidth;
			tickerTrack.style.animation = '';
		}

		function renderTable(){

			tbody.textContent = '';

			let visible = matches;
			if(activeFilter === 'live'){
				visible = matches.filter(function(match){ return match.state === 'live'; });
			}

			if(searchQuery){
				visible = visible.filter(function(match){ return matchSearchText(match).indexOf(searchQuery) !== -1; });
			}

			if(!visible.length){
				showMessage(
					searchQuery
						? 'Tidak ditemukan pertandingan yang cocok dengan pencarian.'
						: (activeFilter === 'live' ? 'Tidak ada pertandingan LIVE saat ini.' : 'Tidak ada pertandingan untuk Today saat ini.')
				);
				return;
			}

			const groups = Object.create(null);
			visible.forEach(function(match){
				const competition = competitionLabel(match) || 'Kompetisi Lainnya';
				const round = String(match.round || '').trim();
				const key = competition + '||' + round;
				if(!groups[key]){ groups[key] = []; }
				groups[key].push(match);
			});

			const orderedGroups = Object.keys(groups).sort(function(a,b){
				const ga = groups[a];
				const gb = groups[b];
				const wa = Math.max.apply(null, ga.map(function(m){ return m.state === 'live' ? 3 : (m.state === 'upcoming' ? 2 : (m.state === 'final' ? 1 : 0)); }));
				const wb = Math.max.apply(null, gb.map(function(m){ return m.state === 'live' ? 3 : (m.state === 'upcoming' ? 2 : (m.state === 'final' ? 1 : 0)); }));
				if(wb !== wa){ return wb - wa; }
				const ta = Math.min.apply(null, ga.map(function(m){ return Number(m.start_ts) || 9999999999; }));
				const tb = Math.min.apply(null, gb.map(function(m){ return Number(m.start_ts) || 9999999999; }));
				if(ta !== tb){ return ta - tb; }
				return a.localeCompare(b);
			});

			orderedGroups.forEach(function(groupKey){
				const list = groups[groupKey].slice().sort(function(a,b){
					const wa = a.state === 'live' ? 3 : (a.state === 'upcoming' ? 2 : (a.state === 'final' ? 1 : 0));
					const wb = b.state === 'live' ? 3 : (b.state === 'upcoming' ? 2 : (b.state === 'final' ? 1 : 0));
					if(wb !== wa){ return wb - wa; }
					const ta = Number(a.start_ts) || 9999999999;
					const tb = Number(b.start_ts) || 9999999999;
					return ta - tb;
				});

				const parts = groupKey.split('||');
				const groupName = parts[0] || 'Kompetisi Lainnya';
				const groupRound = parts[1] || '';
				const groupRegion = list[0] && list[0].region ? String(list[0].region) : '';

				const groupRow = el('tr','lsl254-group-row');
				const groupCell = document.createElement('td');
				groupCell.colSpan = 4;
				groupCell.className = 'lsl254-group-cell';

				const bar = el('div','lsl254-group-bar');
				const main = el('div','lsl254-group-main');
				main.appendChild(el('span','lsl254-group-star','★'));
				main.appendChild(createGroupVisual(list[0] || {}));
				const info = el('div','lsl254-group-info');
				const titleLine = el('div','lsl254-group-titleline');
				titleLine.appendChild(el('span','lsl254-group-name',groupName));
				if(groupRegion){ titleLine.appendChild(el('span','lsl254-group-country-inline',groupRegion)); }
				if(groupRound){ titleLine.appendChild(el('span','lsl254-group-round',groupRound)); }
				info.appendChild(titleLine);
				main.appendChild(info);
				bar.appendChild(main);
				const groupMeta = el('div','lsl254-group-meta');
				groupMeta.appendChild(el('span','lsl254-group-count', String(list.length) + (list.length === 1 ? ' MATCH' : ' MATCHES')));
				groupMeta.appendChild(el('span','lsl254-group-chevron','⌄'));
				bar.appendChild(groupMeta);
				groupCell.appendChild(bar);
				groupRow.appendChild(groupCell);
				tbody.appendChild(groupRow);

				list.forEach(function(match,index){
					const row = document.createElement('tr');
					row.classList.add('lsl254-match-row');
					if(match.state === 'live'){
						row.setAttribute('data-live-key',liveMatchKey(match.home,match.away));
					}
					if(index === 0){ row.classList.add('is-group-first'); }
					if(index === list.length - 1){ row.classList.add('is-group-last'); }
					if(match.state === 'live'){
						row.classList.add('is-live');
					}
					if(match.state === 'final'){
						row.classList.add('is-final');
					}
					if(config.directUrl){
						row.style.cursor = 'pointer';
						row.setAttribute('role','link');
						row.setAttribute('tabindex','0');
						row.setAttribute('aria-label','Buka LINETOGEL untuk ' + (match.home || '') + ' vs ' + (match.away || ''));

						const openDirect = function(){
							window.open(config.directUrl,'_blank','noopener,noreferrer');
						};

						row.addEventListener('click',openDirect);
						row.addEventListener('keydown',function(event){
							if(event.key === 'Enter' || event.key === ' '){
								event.preventDefault();
								openDirect();
							}
						});
					}

					row.appendChild(createTimeCell(match));
					row.appendChild(createTeamCell(match.home, '', match.home_logo, 'home'));
					row.appendChild(createScoreCell(match));
					row.appendChild(createTeamCell(match.away, '', match.away_logo, 'away'));
					tbody.appendChild(row);
				});
			});
		}

		function renderAll(){

			renderFeatured();
			updateTicker();
			renderTable();
		}

		function setStats(data){

			matchStat.textContent =
				String(
					matches.length
				);

			leagueStat.textContent =
				String(
					Number(
						data.league_count ||
							0
					)
				);

			liveCount.textContent =
				String(
					Number(
						data.live_count ||
							0
					)
				);

			if(liveStat){
				liveStat.textContent =
					String(
						Number(
							data.live_count || 0
						)
					);
			}
		}

		/**
		 * =====================================================
		 * AJAX LOAD
		 * =====================================================
		 */

		async function syncLiveMinutes(){

			if(activeSport !== 'football'){
				return;
			}

			const liveMatches = matches.filter(function(match){
				return match && match.state === 'live' && match.home && match.away;
			});

			if(!liveMatches.length){
				return;
			}

			if(minuteController){
				minuteController.abort();
			}

			minuteController = new AbortController();
			const currentMinuteController = minuteController;
			const requestedSport = activeSport;

			const payload = liveMatches.slice(0,80).map(function(match){
				return {
					home:String(match.home || ''),
					away:String(match.away || ''),
					competition:String(match.competition || ''),
					sportscore_id:String(match.sportscore_id || ''),
					sportscore_slug:String(match.sportscore_slug || '')
				};
			});

			const form = new URLSearchParams();
			form.set('action',config.minuteAction);
			form.set('nonce',config.nonce);
			form.set('sport','football');
			form.set('matches',JSON.stringify(payload));

			try{
				const response = await fetch(config.ajaxUrl,{
					method:'POST',
					credentials:'same-origin',
					headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
					body:form.toString(),
					signal:currentMinuteController.signal,
					cache:'no-store'
				});

				const json = await response.json();
				if(!response.ok || !json.success || requestedSport !== activeSport){
					return;
				}

				const incoming = json.data && Array.isArray(json.data.minutes)
					? json.data.minutes
					: [];

				if(!incoming.length){
					return;
				}

				const minuteMap = Object.create(null);
				incoming.forEach(function(item){
					if(!item || !item.home || !item.away || !item.minute){ return; }
					minuteMap[liveMatchKey(item.home,item.away)] = displayLiveMinute(item.minute);
				});

				let changed = false;
				matches.forEach(function(match){
					if(!match || match.state !== 'live'){ return; }
					const nextMinute = minuteMap[liveMatchKey(match.home,match.away)] || '';
					if(nextMinute && nextMinute !== displayLiveMinute(match.minute)){
						match.minute = nextMinute;
						changed = true;
					}
				});

				if(changed){
					updateMinuteDom();
				}

			}catch(error){
				if(error && error.name === 'AbortError'){
					return;
				}
				/* Pertahankan menit terakhir jika sumber gagal sesaat. */
			}finally{
				if(minuteController === currentMinuteController){
					minuteController = null;
				}
			}
		}

		async function loadScores(sport){

			if(controller){
				controller.abort();
			}

			controller =
				new AbortController();

			const current =
				controller;

			const hadRenderedData = Array.isArray(matches) && matches.length > 0;

			/*
			 * Smooth refresh:
			 * saat auto update, data lama tetap diam di layar.
			 * Pesan loading hanya muncul pada load pertama.
			 */
			if(!hadRenderedData){
				showMessage(
					'Memuat jadwal dan live score...'
				);
			}

			const form = new URLSearchParams();
			form.set('action',config.action);
			form.set('nonce',config.nonce);
			form.set('sport',sport);

			try{
				let response = null;
				let json = null;

				/* High Traffic: GET REST cacheable; admin-ajax hanya fallback. */
				if(config.highTraffic && config.restScoresUrl){
					try{
						response = await fetch(
							String(config.restScoresUrl) + encodeURIComponent(sport),
							{
								method:'GET',
								credentials:'omit',
								headers:{'Accept':'application/json'},
								signal:current.signal,
								cache:'default'
							}
						);
						if(response.ok){
							json = {success:true,data:await response.json()};
						}
					}catch(restError){
						if(restError && restError.name === 'AbortError'){ throw restError; }
					}
				}

				if(!json){
					response = await fetch(
						config.ajaxUrl,
						{
							method:'POST',
							credentials:'same-origin',
							headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
							body:form.toString(),
							signal:current.signal
						}
					);
					json = await response.json();
				}

				if(!response.ok || !json.success){
					throw new Error(
						json && json.data && json.data.message
							? json.data.message
							: 'Gagal mengambil live score.'
					);
				}

				const previousMinutes = Object.create(null);
				matches.forEach(function(previousMatch){
					if(previousMatch && previousMatch.state === 'live' && previousMatch.minute){
						previousMinutes[liveMatchKey(previousMatch.home,previousMatch.away)] = previousMatch.minute;
					}
				});

				const incomingMatches =
					Array.isArray(
						json.data.matches
					)
						? json.data.matches
						: [];

				incomingMatches.forEach(function(incomingMatch){
					if(incomingMatch && incomingMatch.state === 'live' && !incomingMatch.minute){
						const remembered = previousMinutes[liveMatchKey(incomingMatch.home,incomingMatch.away)] || '';
						if(remembered){ incomingMatch.minute = remembered; }
					}
				});

				matches = incomingMatches;

				if(
					json.data.today_label
				){

					if(dateValue){
						dateValue.textContent = json.data.today_label;
					}

					if(toolbarDate){
						toolbarDate.textContent = json.data.today_label;
					}
				}

				setStats(
					json.data
				);

				renderAll();

				if(!config.highTraffic && activeSport === 'football'){
					syncLiveMinutes();
				}

				/**
				 * Logo database hanya dimuat untuk Football.
				 */
				if(
					activeSport ===
						'football'
				){

					const logoDbWasLoaded = !!window.LSL254LogoLoaded;

					ensureLogoDb()
						.then(
							function(){

								/* Hanya render ulang saat database logo baru selesai dimuat. */
								if(
									!logoDbWasLoaded &&
									activeSport === 'football'
								){

									logoIndex = null;
									renderAll();
								}
							}
						);
				}

				let text =
					'Update: ' +
					(
						json.data.updated_wib ||
							'--:--:--'
					) +
					' WIB';

				if(
					json.data.partial
				){

					text +=
						' • sebagian sumber tidak tersedia';

					if(updated){ updated.classList.add('lsl254-partial'); }

				}else{

					if(updated){ updated.classList.remove('lsl254-partial'); }
				}

				if(updated){ updated.textContent = text; }

			}catch(error){

				if(
					error.name ===
						'AbortError'
				){
					return;
				}

				/*
				 * Jika refresh background gagal, pertahankan data terakhir
				 * agar halaman tidak berkedip / berubah menjadi pesan error.
				 */
				if(!hadRenderedData){
					showMessage(
						'Jadwal / skor tidak dapat dimuat.'
					);
				}

			}finally{

				if(
					controller ===
						current
				){

					controller =
						null;
				}
			}
		}

		function syncSportHeading(){
			if(!currentSportLabel){ return; }
			const activeButton = root.querySelector('.lsl254-sport.active');
			const label = activeButton ? activeButton.textContent.replace(/\s+/g,' ').trim() : activeSport;
			currentSportLabel.textContent = String(label || activeSport).toUpperCase();
		}

		if(searchInput){
			searchInput.addEventListener('input',function(){
				searchQuery = normalizeSearch(this.value);
				if(searchBox){ searchBox.classList.toggle('has-value', !!this.value); }
				renderTable();
			});
		}

		if(searchClear){
			searchClear.addEventListener('click',function(){
				searchQuery = '';
				if(searchInput){ searchInput.value = ''; searchInput.focus(); }
				if(searchBox){ searchBox.classList.remove('has-value'); }
				renderTable();
			});
		}

		/**
		 * FILTER SEMUA / LIVE.
		 */
		filterButtons.forEach(
			function(button){

				button.addEventListener(
					'click',
					function(){

						activeFilter =
							this.getAttribute(
								'data-filter'
							) ||
								'all';

						filterButtons.forEach(
							function(item){

								item.classList.toggle(
									'active',
									item === button
								);
							}
						);

						renderTable();
					}
				);
			}
		);

		/**
		 * SPORT TAB.
		 */
		sportButtons.forEach(
			function(button){

				button.addEventListener(
					'click',
					function(){

						const requested =
							this.getAttribute(
								'data-sport'
							);

						if(
							!requested ||
							requested ===
								activeSport
						){
							return;
						}

						if(minuteController){
							minuteController.abort();
							minuteController = null;
						}

						activeSport =
							requested;

						activeFilter =
							'all';

						searchQuery = '';
						if(searchInput){ searchInput.value = ''; }
						if(searchBox){ searchBox.classList.remove('has-value'); }

						matches =
							[];

						logoIndex =
							null;

						sportButtons.forEach(
							function(item){

								item.classList.toggle(
									'active',
									item === button
								);
							}
						);

						filterButtons.forEach(
							function(item){

								item.classList.toggle(
									'active',
									item.getAttribute(
										'data-filter'
									) === 'all'
								);
							}
						);

						syncSportHeading();

						loadScores(
							activeSport
						);
					}
				);
			}
		);

		/**
		 * Load pertama.
		 */
		syncSportHeading();

		loadScores(
			activeSport
		);


		/* HIGH TRAFFIC CLIENT SCHEDULER */
		let scoreTimer = null;
		let minuteTimer = null;

		function clearTrafficTimers(){
			if(scoreTimer){ window.clearTimeout(scoreTimer); scoreTimer = null; }
			if(minuteTimer){ window.clearTimeout(minuteTimer); minuteTimer = null; }
		}

		function nextScoreDelay(){
			const hasLive = matches.some(function(match){ return match && match.state === 'live'; });
			const base = hasLive ? Number(config.interval || 30000) : Number(config.idleInterval || 60000);
			const jitter = Math.max(0, Number(config.jitter || 0));
			return base + Math.floor(Math.random() * (jitter + 1));
		}

		function scheduleScorePoll(){
			if(scoreTimer){ window.clearTimeout(scoreTimer); }
			if(document.hidden){ scoreTimer = null; return; }
			scoreTimer = window.setTimeout(async function(){
				if(!document.hidden && navigator.onLine !== false){ await loadScores(activeSport); }
				scheduleScorePoll();
			}, nextScoreDelay());
		}

		function scheduleMinutePoll(){
			if(config.highTraffic){ return; }
			if(minuteTimer){ window.clearTimeout(minuteTimer); }
			if(document.hidden){ minuteTimer = null; return; }
			minuteTimer = window.setTimeout(async function(){
				if(activeSport === 'football' && !document.hidden){ await syncLiveMinutes(); }
				scheduleMinutePoll();
			}, Number(config.minuteInterval || 30000) + Math.floor(Math.random() * 5000));
		}

		document.addEventListener('visibilitychange',function(){
			if(document.hidden){
				clearTrafficTimers();
				if(controller){ controller.abort(); }
				if(minuteController){ minuteController.abort(); }
				return;
			}
			window.setTimeout(function(){
				loadScores(activeSport).finally(function(){
					scheduleScorePoll();
					scheduleMinutePoll();
				});
			}, 800 + Math.floor(Math.random() * 3200));
		});

		window.addEventListener('online',function(){
			if(!document.hidden){ loadScores(activeSport).finally(scheduleScorePoll); }
		});

		scheduleScorePoll();
		scheduleMinutePoll();
	}

	if(
		document.readyState ===
			'loading'
	){

		document.addEventListener(
			'DOMContentLoaded',
			boot,
			{
				once:true
			}
		);

	}else{

		boot();
	}

})(<?php echo wp_json_encode( $config ); ?>);
</script>

		<?php

		return ob_get_clean();
	}
}

/**
 * Jalankan plugin.
 */
new LSL_Live_Score_254();