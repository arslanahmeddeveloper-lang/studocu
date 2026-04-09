<?php
/**
 * Plugin Name:       StuDocu Downloader Plugin
 * Plugin URI:        https://example.com/
 * Description:       A secure shortcode to display the StuDocu document downloader tool.
 * Version:           3.0.0
 * Requires at least: 5.2
 * Requires PHP:      7.2
 * Author:            Mudassir Asghar
 * Author URI:        https://author.example.com/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       studocu-plugin
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

function studocu_downloader_assets()
{
    if (is_singular() && has_shortcode(get_post()->post_content, 'studocu_display')) {

        wp_enqueue_style(
            'studocu-google-fonts',
            'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap',
            [],
            null
        );

        wp_enqueue_style(
            'studocu-downloader-style',
            plugin_dir_url(__FILE__) . 'studocu-downloader.css',
            ['studocu-google-fonts'],
            '3.0.0'
        );

        wp_enqueue_script(
            'studocu-downloader-script',
            plugin_dir_url(__FILE__) . 'studocu-downloader.js',
            [],
            '3.0.0',
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'studocu_downloader_assets');

function studocu_display_shortcode()
{
    ob_start();
    ?>
    <div class="studocu-container">
        <div class="header">
            <h1>Paste Your StuDocu Link Below</h1>
        </div>
        <div class="main-content">
            <div class="form-container">
                <div class="input-wrapper">
                    <input type="text" id="studocu-url" placeholder="https://www.studocu.com/en-us/document/..."
                        autocomplete="off" spellcheck="false">
                    <button id="clear-btn" title="Clear" tabindex="-1">&times;</button>
                </div>
                <button id="download-btn">
                    <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span class="btn-text">Download Free</span>
                    <span class="btn-loader"></span>
                </button>
            </div>

            <div class="progress-section" id="progress-section" style="display: none;">
                <div class="progress-track">
                    <div class="progress-bar" id="progress-bar"></div>
                </div>
                <p id="status-text">Initializing...</p>
            </div>

            <div class="status-indicator error" id="error-indicator" style="display: none;"></div>

            <div class="trust-badges">
                <div class="badge">
                    <span class="badge-check">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </span>
                    No registration
                </div>

                <div class="badge">
                    <span class="badge-check">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </span>
                    Unlimited downloads
                </div>
                <div class="badge">
                    <span class="badge-check">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </span>
                    All devices supported
                </div>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('studocu_display', 'studocu_display_shortcode');