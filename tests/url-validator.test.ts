import { is_valid_url } from '../src/js/libs/url-validator.js';

describe('URL Validator (SSRF Protection)', () => {
	describe('Valid URLs', () => {
		it('should accept HTTPS URLs', () => {
			expect(is_valid_url('https://example.com/image.png')).toBe(true);
			expect(is_valid_url('https://cdn.example.com/path/to/image.jpg')).toBe(true);
			expect(is_valid_url('https://sub.domain.example.com/image.webp')).toBe(true);
		});

		it('should accept HTTP URLs', () => {
			expect(is_valid_url('http://example.com/image.png')).toBe(true);
			expect(is_valid_url('http://example.com:8080/image.jpg')).toBe(true);
		});

		it('should accept URLs with query parameters', () => {
			expect(is_valid_url('https://example.com/image.png?width=100&height=100')).toBe(true);
			expect(is_valid_url('https://example.com/api/image?id=123')).toBe(true);
		});

		it('should accept URLs with fragments', () => {
			expect(is_valid_url('https://example.com/image.png#section')).toBe(true);
		});

		it('should accept URLs with ports', () => {
			expect(is_valid_url('https://example.com:443/image.png')).toBe(true);
			expect(is_valid_url('http://example.com:80/image.png')).toBe(true);
			expect(is_valid_url('https://example.com:8443/image.png')).toBe(true);
		});
	});

	describe('Blocked: Private IP ranges', () => {
		it('should block 10.0.0.0/8', () => {
			expect(is_valid_url('http://10.0.0.1/image.png')).toBe(false);
			expect(is_valid_url('http://10.255.255.255/image.png')).toBe(false);
			expect(is_valid_url('http://10.1.2.3/image.png')).toBe(false);
		});

		it('should block 172.16.0.0/12', () => {
			expect(is_valid_url('http://172.16.0.1/image.png')).toBe(false);
			expect(is_valid_url('http://172.31.255.255/image.png')).toBe(false);
			expect(is_valid_url('http://172.20.1.1/image.png')).toBe(false);
		});

		it('should block 192.168.0.0/16', () => {
			expect(is_valid_url('http://192.168.0.1/image.png')).toBe(false);
			expect(is_valid_url('http://192.168.255.255/image.png')).toBe(false);
			expect(is_valid_url('http://192.168.1.100/image.png')).toBe(false);
		});

		it('should block 169.254.0.0/16 (link-local)', () => {
			expect(is_valid_url('http://169.254.0.1/image.png')).toBe(false);
			expect(is_valid_url('http://169.254.169.254/image.png')).toBe(false); // AWS metadata
		});

		it('should block 127.0.0.0/8 (loopback)', () => {
			expect(is_valid_url('http://127.0.0.1/image.png')).toBe(false);
			expect(is_valid_url('http://127.0.0.2/image.png')).toBe(false);
			expect(is_valid_url('http://127.255.255.255/image.png')).toBe(false);
		});

		it('should block 0.0.0.0', () => {
			expect(is_valid_url('http://0.0.0.0/image.png')).toBe(false);
		});
	});

	describe('Blocked: IPv6 addresses', () => {
		it('should block ::1 (loopback)', () => {
			expect(is_valid_url('http://[::1]/image.png')).toBe(false);
		});

		it('should block fe80::/10 (link-local)', () => {
			expect(is_valid_url('http://[fe80::1]/image.png')).toBe(false);
			expect(is_valid_url('http://[fe80::ffff]/image.png')).toBe(false);
		});

		it('should block fc00::/7 (unique local)', () => {
			expect(is_valid_url('http://[fc00::1]/image.png')).toBe(false);
			expect(is_valid_url('http://[fd00::1]/image.png')).toBe(false);
			expect(is_valid_url('http://[fd12:3456::1]/image.png')).toBe(false);
		});
	});

	describe('Blocked: Localhost and local domains', () => {
		it('should block localhost', () => {
			expect(is_valid_url('http://localhost/image.png')).toBe(false);
			expect(is_valid_url('http://localhost:3000/image.png')).toBe(false);
		});

		it('should block localhost.localdomain', () => {
			expect(is_valid_url('http://localhost.localdomain/image.png')).toBe(false);
		});

		it('should block .local TLD (mDNS)', () => {
			expect(is_valid_url('http://mycomputer.local/image.png')).toBe(false);
			expect(is_valid_url('http://printer.local/image.png')).toBe(false);
		});
	});

	describe('Blocked: Invalid protocols', () => {
		it('should block FTP', () => {
			expect(is_valid_url('ftp://example.com/image.png')).toBe(false);
		});

		it('should block file:// protocol', () => {
			expect(is_valid_url('file:///etc/passwd')).toBe(false);
		});

		it('should block javascript: protocol', () => {
			expect(is_valid_url('javascript:alert(1)')).toBe(false);
		});

		it('should block data: protocol', () => {
			expect(is_valid_url('data:image/png;base64,abc')).toBe(false);
		});

		it('should block custom protocols', () => {
			expect(is_valid_url('custom://example.com/image.png')).toBe(false);
		});
	});

	describe('Invalid URLs', () => {
		it('should reject malformed URLs', () => {
			expect(is_valid_url('not-a-url')).toBe(false);
			expect(is_valid_url('http://')).toBe(false);
			expect(is_valid_url('')).toBe(false);
			expect(is_valid_url('   ')).toBe(false);
		});

		it('should reject completely malformed URLs', () => {
			expect(is_valid_url('not-a-url-at-all')).toBe(false);
			expect(is_valid_url('')).toBe(false);
			expect(is_valid_url('http://')).toBe(false);
		});
	});
});
