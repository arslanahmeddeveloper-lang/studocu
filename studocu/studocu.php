<?php
/**
 * Plugin Name:       StuDocu Downloader Plugin
 * Plugin URI:        https://example.com/
 * Description:       A secure shortcode to display the StuDocu document downloader tool.
 * Version:           1.1.0
 * Requires at least: 5.2
 * Requires PHP:      7.2
 * Author:            Mudassir Asghar (Updated for Security)
 * Author URI:        https://author.example.com/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       studocu-plugin
 * Domain Path:       /languages
 */

// Security First: Prevent direct access to this file
if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

/**
 * Enqueues the necessary CSS and JavaScript files for the downloader.
 *
 * This is the correct and secure way to add assets in WordPress.
 */
function studocu_downloader_assets()
{
    // Only load the scripts and styles on pages where the shortcode is present.
    // This is a performance optimization.
    if (is_singular() && has_shortcode(get_post()->post_content, 'studocu_display')) {

        // Enqueue the stylesheet
        wp_enqueue_style(
            'studocu-downloader-style', // A unique handle for the stylesheet
            plugin_dir_url(__FILE__) . 'studocu-downloader.css', // Path to the CSS file
            [], // No dependencies
            '1.1.0' // Version number
        );

        // Enqueue the JavaScript file
        wp_enqueue_script(
            'studocu-downloader-script', // A unique handle for the script
            plugin_dir_url(__FILE__) . 'studocu-downloader.js', // Path to the JS file
            [], // No dependencies
            '1.1.0', // Version number
            true // Load the script in the footer for better performance
        );
    }
}
// Hook the function into the right action
add_action('wp_enqueue_scripts', 'studocu_downloader_assets');


/**
 * Renders the HTML for the StuDocu downloader.
 *
 * This function no longer reads from a file, preventing file-based XSS attacks.
 * It returns a string of safe, known HTML.
 *
 * @return string The HTML content for the downloader.
 */
function studocu_display_shortcode()
{
    // Use output buffering to capture the HTML
    ob_start();
    ?>
    <div class="studocu-container">
        <div class="header">
            <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
            </svg>
            <div>StuDocu Document Downloader</div>
            <p>Paste a valid StuDocu document URL to generate and download a PDF.</p>
        </div>
        <div class="main-content">
            <div class="form-container">
                <input type="text" id="studocu-url" placeholder="https://www.studocu.com/en-us/document/...">
                <button id="download-btn">
                    <span class="btn-text">Download</span>
                    <span class="btn-loader"></span>
                </button>
            </div>

            <div class="progress-section" id="progress-section" style="display: none;">
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progress-bar"></div>
                </div>
                <p id="status-text">Starting...</p>
            </div>

            <div class="status-indicator error" id="error-indicator" style="display: none;"></div>
        </div>
    </div>
    <?php
    // Return the buffered content
    return ob_get_clean();
}

// Register the shortcode [studocu_display]
add_shortcode('studocu_display', 'studocu_display_shortcode');