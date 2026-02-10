import { vi } from 'vitest';

// Mock Chrome Storage API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    getBytesInUse: vi.fn(),
  },
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Mock Chrome Alarms API
const mockAlarms = {
  create: vi.fn(),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Mock Chrome Runtime API
const mockRuntime = {
  onInstalled: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Setup global chrome object
global.chrome = {
  storage: mockStorage,
  alarms: mockAlarms,
  runtime: mockRuntime,
} as any;
