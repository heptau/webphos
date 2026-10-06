/**
 * URL validator to prevent SSRF attacks
 * 
 * @author ViliusL
 */

/**
 * Checks if a URL is valid and safe to fetch
 * Prevents access to internal/private networks (SSRF protection)
 * 
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if URL is safe, false otherwise
 */
export function is_valid_url(url) {
	try {
		const parsed = new URL(url);
		
		// Only allow HTTP/HTTPS protocols
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return false;
		}
		
		const hostname = parsed.hostname.toLowerCase();
		
		// Block localhost and local network addresses
		if (is_local_address(hostname)) {
			return false;
		}
		
		// Block private IP ranges
		if (is_private_ip(hostname)) {
			return false;
		}
		
		// Block link-local addresses
		if (is_link_local(hostname)) {
			return false;
		}
		
		// Block loopback
		if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
			return false;
		}
		
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Check if hostname resolves to a local address
 */
function is_local_address(hostname) {
	const localPatterns = [
		/^localhost$/,
		/^localhost\.localdomain$/,
		/^\[::1\]$/,
		/^127\./,
		/^0\./,
	];
	
	return localPatterns.some(pattern => pattern.test(hostname));
}

/**
 * Check if hostname is a private IP address
 */
function is_private_ip(hostname) {
	// Check for IPv4 private ranges
	const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (ipv4Match) {
		const [, a, b, c, d] = ipv4Match.map(Number);
		
		// 10.0.0.0/8
		if (a === 10) return true;
		// 172.16.0.0/12
		if (a === 172 && b >= 16 && b <= 31) return true;
		// 192.168.0.0/16
		if (a === 192 && b === 168) return true;
		// 169.254.0.0/16 (link-local)
		if (a === 169 && b === 254) return true;
	}
	
	// Check for IPv6 private ranges (simplified)
	if (hostname.startsWith('[') && hostname.endsWith(']')) {
		const ipv6 = hostname.slice(1, -1);
		// ::1 (loopback)
		if (ipv6 === '::1') return true;
		// fe80::/10 (link-local)
		if (ipv6.match(/^fe80:/i)) return true;
		// fc00::/7 (unique local) - first 7 bits fixed, covers fc00::/8 and fd00::/8
		if (ipv6.match(/^fc[0-9a-f]{0,3}:/i) || ipv6.match(/^fd[0-9a-f]{0,3}:/i)) return true;
	}
	
	return false;
}

/**
 * Check if hostname is a link-local address
 */
function is_link_local(hostname) {
	// 169.254.0.0/16 is already checked in is_private_ip
	// Check for .local TLD (mDNS)
	if (hostname.endsWith('.local')) {
		return true;
	}
	return false;
}