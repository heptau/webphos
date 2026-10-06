import {
  validate_file,
  validate_json_file,
  validate_image_url,
  validate_data_url,
  sanitize_filename,
  validate_layer_name,
  validate_color,
} from '../src/js/libs/input-validator.js';

describe('Input Validator', () => {
  // Mock File constructor
  const createMockFile = (name: string, size: number, type: string = 'image/png') => {
    const file = new File([''], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  describe('validate_file', () => {
    it('should accept valid PNG file', () => {
      const file = createMockFile('test.png', 1024, 'image/png');
      const result = validate_file(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should accept valid JPEG file', () => {
      const file = createMockFile('test.jpg', 1024, 'image/jpeg');
      const result = validate_file(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid WebP file', () => {
      const file = createMockFile('test.webp', 1024, 'image/webp');
      const result = validate_file(file);
      expect(result.valid).toBe(true);
    });

    it('should reject file too large', () => {
      const file = createMockFile('large.png', 60 * 1024 * 1024); // 60MB
      const result = validate_file(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('50.00 MB');
    });

    it('should reject invalid file type', () => {
      const file = createMockFile('test.exe', 1024, 'application/x-msdownload');
      const result = validate_file(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject invalid extension', () => {
      const file = createMockFile('test.php', 1024, 'image/png');
      const result = validate_file(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file extension');
    });

    it('should accept file with case-insensitive extension', () => {
      const file = createMockFile('test.PNG', 1024, 'image/png');
      const result = validate_file(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate_image_url', () => {
    it('should accept valid HTTPS URL', () => {
      const result = validate_image_url('https://example.com/image.png');
      expect(result.valid).toBe(true);
    });

    it('should accept valid HTTP URL', () => {
      const result = validate_image_url('http://example.com/image.png');
      expect(result.valid).toBe(true);
    });

    it('should reject localhost URLs', () => {
      const result = validate_image_url('http://localhost/image.png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Local/private URLs');
    });

    it('should reject private IP ranges', () => {
      expect(validate_image_url('http://192.168.1.1/image.png').valid).toBe(false);
      expect(validate_image_url('http://10.0.0.1/image.png').valid).toBe(false);
      expect(validate_image_url('http://172.16.0.1/image.png').valid).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const result = validate_image_url('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject FTP protocol', () => {
      const result = validate_image_url('ftp://example.com/image.png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only HTTP/HTTPS');
    });
  });

  describe('validate_data_url', () => {
    it('should accept valid base64 PNG data URL', () => {
      // 1x1 transparent PNG
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = validate_data_url(dataUrl);
      expect(result.valid).toBe(true);
    });

    it('should accept valid JPEG data URL', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFBABAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/AB//2Q==';
      const result = validate_data_url(dataUrl);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid data URL format', () => {
      const result = validate_data_url('not-a-data-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid data URL format');
    });

    it('should reject unsupported MIME type', () => {
      const dataUrl = 'data:application/pdf;base64,JVBERi0xLjQK';
      const result = validate_data_url(dataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported image type');
    });

    it('should reject too large data URL', () => {
      // Create a base64 string that when decoded exceeds 50MB
      // Base64 is ~33% larger than binary, so we need ~67MB base64 for 50MB binary
      const largeBase64 = 'A'.repeat(70 * 1024 * 1024); // ~70MB base64
      const dataUrl = `data:image/png;base64,${largeBase64}`;
      const result = validate_data_url(dataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum size');
    });
  });

  describe('sanitize_filename', () => {
    it('should remove path traversal attempts', () => {
      // ../ patterns are removed entirely for security
      expect(sanitize_filename('../../../etc/passwd')).toBe('etc_passwd');
      expect(sanitize_filename('folder/../file.png')).toBe('folder_file.png');
    });

    it('should remove control characters', () => {
      expect(sanitize_filename('file\x00\x1f.png')).toBe('file.png');
    });

    it('should limit length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.png';
      const result = sanitize_filename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.png')).toBe(true);
    });

    it('should handle empty filename', () => {
      expect(sanitize_filename('')).toBe('unnamed');
      expect(sanitize_filename(null as any)).toBe('unnamed');
    });
  });

  describe('validate_layer_name', () => {
    it('should accept valid layer name', () => {
      const result = validate_layer_name('My Layer');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('My Layer');
    });

    it('should reject empty name', () => {
      const result = validate_layer_name('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Layer name is required');
    });

    it('should reject name with dangerous characters', () => {
      const result = validate_layer_name('Layer <script>alert(1)</script>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
      expect(result.sanitized).toContain('_');
    });

    it('should trim whitespace', () => {
      const result = validate_layer_name('  Layer Name  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Layer Name');
    });

    it('should limit length to 200 characters', () => {
      const longName = 'a'.repeat(250);
      const result = validate_layer_name(longName);
      expect(result.sanitized.length).toBeLessThanOrEqual(200);
    });
  });

  describe('validate_color', () => {
    it('should accept valid hex colors', () => {
      expect(validate_color('#ff0000').valid).toBe(true);
      expect(validate_color('#FF0000').valid).toBe(true);
      expect(validate_color('#f00').valid).toBe(true);
      expect(validate_color('#ff0000ff').valid).toBe(true); // 8-char with alpha
    });

    it('should reject invalid hex colors', () => {
      expect(validate_color('#gg0000').valid).toBe(false);
      expect(validate_color('#ff00').valid).toBe(false);
      expect(validate_color('ff0000').valid).toBe(false);
    });

    it('should accept valid RGB colors', () => {
      expect(validate_color('rgb(255, 0, 0)').valid).toBe(true);
      expect(validate_color('rgb(0, 128, 255)').valid).toBe(true);
    });

    it('should accept valid RGBA colors', () => {
      expect(validate_color('rgba(255, 0, 0, 0.5)').valid).toBe(true);
      expect(validate_color('rgba(0, 0, 0, 1)').valid).toBe(true);
    });

    it('should reject invalid RGB values', () => {
      expect(validate_color('rgb(256, 0, 0)').valid).toBe(false);
      expect(validate_color('rgb(-1, 0, 0)').valid).toBe(false);
      expect(validate_color('rgba(0, 0, 0, 1.5)').valid).toBe(false);
    });

    it('should accept named colors', () => {
      expect(validate_color('transparent').valid).toBe(true);
      expect(validate_color('black').valid).toBe(true);
      expect(validate_color('white').valid).toBe(true);
      expect(validate_color('red').valid).toBe(true);
    });

    it('should reject unknown color formats', () => {
      expect(validate_color('hsl(0, 100%, 50%)').valid).toBe(false);
      expect(validate_color('invalid').valid).toBe(false);
    });
  });
});