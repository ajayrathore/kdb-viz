# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Codebase

This is a vendored/customized version of the `node-q` library for KDB+ connectivity. It provides JavaScript/Node.js client functionality for connecting to and querying KDB+ databases. The library has been modified specifically for the KDB+ visualization project to handle temporal data types correctly.

## Architecture Overview

### Core Components

- **`index.cjs`**: Main entry point, exports the `connect()` function and handles connection management
- **`lib/c.cjs`**: Core serialization/deserialization engine for KDB+ IPC protocol
- **`lib/typed.cjs`**: Type wrapper system for handling KDB+ typed data
- **`lib/assert.cjs`**: Internal assertion utilities

### Key Functionality

**Connection Management (`index.cjs`)**:
- `Connection` class extends EventEmitter for async KDB+ connections
- Supports both TCP and TLS connections
- Handles authentication, compression, and connection lifecycle
- Methods: `k()` for synchronous queries, `ks()` for asynchronous queries, `close()`

**Serialization/Deserialization (`lib/c.cjs`)**:
- Implements KDB+ IPC protocol for binary data exchange
- Maps KDB+ type codes (1-19) to JavaScript types
- Handles compression/decompression of query results
- Critical temporal type handlers: `rSecond()`, `rMinute()`, `rTime()`, `rTimestamp()`, etc.

### KDB+ Type System

The library maps KDB+ types to JavaScript types via `QTYPES2NUM`:
- `boolean` (1), `guid` (2), `byte` (4), `short` (5), `int` (6), `long` (7)
- `real` (8), `float` (9), `char` (10), `symbol` (11)
- **Temporal types**: `timestamp` (12), `month` (13), `date` (14), `datetime` (15), `timespan` (16), `minute` (17), `second` (18), `time` (19)

### Custom Modifications

**Temporal Data Handling**: 
This version has been customized to handle KDB+ temporal types correctly for chart visualization:

- **`rSecond()` (type 18h)**: Converts seconds-from-midnight to "HH:MM:SS" time strings
- **`rMinute()` (type 17h)**: Converts minutes-from-midnight to "HH:MM" time strings  
- **`rTime()` (type 19h)**: Converts milliseconds-from-midnight to "HH:MM:SS.mmm" time strings

These modifications ensure temporal data displays correctly in charts without fictitious date components.

### Data Flow

1. **Connection**: `connect(params, callback)` establishes KDB+ connection
2. **Query Execution**: `connection.k(query, callback)` sends queries
3. **Deserialization**: Raw binary responses processed through `deserialize()`
4. **Type Conversion**: KDB+ types converted to JavaScript types via type-specific functions
5. **Result Return**: Structured data returned to calling application

### Debugging

The temporal conversion functions include debug logging:
- `DEBUG: rSecond() called with val: X`
- `DEBUG: rSecond() returning timeStr: HH:MM:SS`

Enable debugging to trace temporal data conversion issues.

### Important Notes

- Uses deprecated `Buffer()` constructor (generates warnings)
- Requires `long`, `node-uuid`, and `buffer-indexof-polyfill` dependencies
- Implements KDB+ IPC protocol v3.x with compression support
- Handles null values, infinities, and special KDB+ numeric values
- Array deserialization includes debugging for temporal types (17h, 18h, 19h)