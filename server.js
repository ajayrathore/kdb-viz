import express from 'express';
import cors from 'cors';
import * as nodeq from './lib/node-q/index.cjs';

// Helper function to safely convert KDB+ symbol objects to strings
function toStringValue(value) {
  if (value == null) return '';
  
  // Handle KDB+ symbol objects (from node-q)
  if (typeof value === 'object' && value.constructor && value.constructor.name === 'Symbol') {
    return value.toString();
  }
  
  // Handle KDB+ symbol objects with __kdb_type
  if (typeof value === 'object' && value !== null && value.__kdb_type === 'symbol') {
    return value.value || value.toString();
  }
  
  // Handle regular strings
  if (typeof value === 'string') {
    return value;
  }
  
  // Convert other types to string
  return String(value);
}

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// KDB+ connection management
let kdbConnection = null;
let connectionConfig = null;

// Helper function to connect to KDB+ process using node-q
const connectToKdb = async (host, port) => {
  return new Promise((resolve, reject) => {
    // Close existing connection if any
    if (kdbConnection) {
      try {
        kdbConnection.close();
      } catch (e) {
        console.warn('Error closing existing connection:', e.message);
      }
      kdbConnection = null;
    }
    
    // Create new KDB+ connection using node-q
    try {
      console.log(`Attempting to connect to KDB+ at ${host}:${port}`);
      
      nodeq.connect({
        host: host,
        port: parseInt(port)
      }, (err, connection) => {
        if (err) {
          console.error('Connection error:', err);
          reject(new Error(`Failed to connect to KDB+ at ${host}:${port} - ${err.message || err}`));
          return;
        }
        
        kdbConnection = connection;
        connectionConfig = { host, port };
        
        console.log(`Successfully connected to KDB+ at ${host}:${port}`);
        
        // Handle connection events
        connection.on('error', (error) => {
          console.error('KDB+ connection error:', error);
          kdbConnection = null;
        });
        
        connection.on('close', () => {
          console.log('KDB+ connection closed');
          kdbConnection = null;
        });
        
        resolve(true);
      });
      
    } catch (error) {
      console.error('Error creating connection:', error);
      reject(new Error(`Failed to create KDB+ connection: ${error.message}`));
    }
  });
};

// Execute KDB+ queries using node-q
const executeKdbQuery = async (query) => {
  if (!kdbConnection) {
    throw new Error('Not connected to KDB+ server');
  }

  return new Promise((resolve, reject) => {
    try {
      console.log(`Executing KDB+ query: ${query}`);
      
      kdbConnection.k(query, (err, result) => {
        if (err) {
          console.error(`Query failed: ${query}`, err);
          reject(new Error(`Query execution failed: ${err.message || err}`));
          return;
        }
        
        console.log(`Query successful: ${query}`, typeof result, Array.isArray(result) ? `Array(${result.length})` : result);
        
        // AGGRESSIVE DEBUG: Log the raw result structure
        console.log('=== RAW KDB+ RESULT DEBUG ===');
        console.log('Result type:', typeof result);
        console.log('Is array:', Array.isArray(result));
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          console.log('Object keys:', Object.keys(result));
          Object.keys(result).forEach(key => {
            const value = result[key];
            if (Array.isArray(value)) {
              console.log(`  ${key}: Array[${value.length}] - first few:`, value.slice(0, 3), `(types: ${value.slice(0, 3).map(v => typeof v).join(', ')})`);
            } else {
              console.log(`  ${key}:`, value, `(${typeof value})`);
            }
          });
        }
        console.log('================================');
        
        resolve(result);
      });
    } catch (error) {
      console.error(`Error executing query: ${query}`, error);
      reject(new Error(`Query execution error: ${error.message}`));
    }
  });
};

// Helper function to parse KDB+ table list
const parseTableList = (result) => {
  if (!result) return [];
  
  // result should be an array of table names
  if (Array.isArray(result)) {
    return result.map(tableName => ({
      name: toStringValue(tableName), // Convert symbol objects to strings
      columns: [], // Will be populated when table is selected
      rowCount: 0   // Will be populated when table is selected
    }));
  }
  
  return [];
};

// Helper function to get table metadata
const getTableMetadata = async (tableName) => {
  try {
    // Ensure tableName is a string for query construction
    const tableNameStr = toStringValue(tableName);
    
    // Get column names by querying the table structure
    // Use cols command to get column names directly
    const colsResult = await executeKdbQuery(`cols ${tableNameStr}`);
    let columns = [];
    
    if (Array.isArray(colsResult)) {
      columns = colsResult;
    } else if (typeof colsResult === 'object' && colsResult !== null) {
      columns = Object.keys(colsResult);
    }
    
    // Get row count
    const countResult = await executeKdbQuery(`count ${tableNameStr}`);
    const rowCount = typeof countResult === 'number' ? countResult : 0;
    
    console.log(`Table ${tableNameStr} metadata:`, { columns, rowCount });
    return { columns, rowCount };
  } catch (error) {
    console.warn(`Failed to get metadata for table ${tableNameStr}:`, error.message);
    // Fallback: try to get column names from a single row
    try {
      const sampleResult = await executeKdbQuery(`1#${tableNameStr}`);
      if (Array.isArray(sampleResult) && sampleResult.length > 0 && typeof sampleResult[0] === 'object') {
        const columns = Object.keys(sampleResult[0]);
        const countResult = await executeKdbQuery(`count ${tableNameStr}`);
        const rowCount = typeof countResult === 'number' ? countResult : 0;
        console.log(`Table ${tableNameStr} fallback metadata:`, { columns, rowCount });
        return { columns, rowCount };
      }
    } catch (fallbackError) {
      console.warn(`Fallback metadata failed for ${tableNameStr}:`, fallbackError.message);
    }
    return { columns: [], rowCount: 0 };
  }
};

// Helper function to convert KDB+ data types to JavaScript compatible values
const convertKdbValue = (value, columnName = '', expectedType = '') => {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle KDB+ specific null/infinity values
  if (typeof value === 'number') {
    if (value === -2147483648) return null; // KDB+ null int
    if (value === -9223372036854775808) return null; // KDB+ null long
    if (isNaN(value)) return null;
    if (!isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
    
    // REMOVED: Dangerous server-side numeric-to-time conversion
    // Node-q handles all temporal conversions correctly at deserialization level
  }
  
  // Handle KDB+ timestamps (if it's already a Date object)
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // Handle strings with potential encoding issues
  if (typeof value === 'string') {
    return value.toString();
  }
  
  // For all other values, return as-is
  return value;
};

// Helper function to format query results for frontend
const formatQueryResult = (result) => {
  console.log('=== DEBUG: formatQueryResult input ===');
  console.log('Result type:', typeof result);
  console.log('Result is array:', Array.isArray(result));
  if (result && typeof result === 'object') {
    console.log('Result keys:', Object.keys(result));
    if (Array.isArray(result) && result.length > 0) {
      console.log('First row:', result[0]);
      console.log('First row type:', typeof result[0]);
    } else if (!Array.isArray(result)) {
      const keys = Object.keys(result);
      keys.forEach(key => {
        const value = result[key];
        console.log(`Column "${key}":`, Array.isArray(value) ? `Array[${value.length}] - first value: ${value[0]} (${typeof value[0]})` : `${value} (${typeof value})`);
      });
    }
  }
  console.log('=======================================');

  if (!result) {
    return {
      columns: [],
      data: [],
      meta: { types: [], count: 0 }
    };
  }

  // Handle different result types
  if (Array.isArray(result)) {
    // Check if it's an array of objects (table rows from KDB+)
    if (result.length > 0 && typeof result[0] === 'object' && result[0] !== null && !Array.isArray(result[0])) {
      // This is a table result - extract columns from first row
      const columns = Object.keys(result[0]);
      
      // First pass: determine types (safe approach - trust node-q, classify strings only)
      const types = columns.map(col => {
        const sampleValue = result[0][col];
        
        if (typeof sampleValue === 'number') {
          // Never convert numbers - let them stay as numbers
          // Node-q already handled any necessary temporal conversions
          return 'number';
        }
        
        // Check for KDB+ symbol objects first
        if (typeof sampleValue === 'object' && sampleValue !== null && sampleValue.__kdb_type === 'symbol') {
          return 'symbol';
        }
        
        if (typeof sampleValue === 'string') {
          // Check for KDB+ time patterns - most specific first!
          // Check exact HH:MM:SS format first (no milliseconds)
          if (/^\d{2}:\d{2}:\d{2}$/.test(sampleValue)) {
            return 'second'; // HH:MM:SS from KDB+ second type (18h)
          }
          // Then check HH:MM:SS.mmm format  
          if (/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(sampleValue)) {
            return 'time'; // HH:MM:SS.mmm from KDB+ time type (19h)
          }
          // Finally check HH:MM format
          if (/^\d{2}:\d{2}$/.test(sampleValue)) {
            return 'minute'; // HH:MM from KDB+ minute type (17h)
          }
          if (sampleValue.includes('T')) {
            return 'datetime'; // ISO datetime
          }
          return 'string';
        }
        
        if (sampleValue instanceof Date) return 'datetime';
        return 'mixed';
      });
      
      // Second pass: convert data using type information
      const data = result.map(row => 
        columns.map((col, colIndex) => convertKdbValue(row[col], col, types[colIndex]))
      );

      return {
        columns,
        data,
        meta: { 
          types, 
          count: result.length 
        }
      };
    }
    
    // Check if it's an array of symbols/strings (table names)
    if (result.length > 0 && typeof result[0] === 'string') {
      return {
        columns: ['name'],
        data: result.map(item => [convertKdbValue(item, 'name', 'string')]),
        meta: { types: ['string'], count: result.length }
      };
    }
    
    // Simple array result
    return {
      columns: ['result'],
      data: result.map(item => [convertKdbValue(item, 'result', 'mixed')]),
      meta: { types: ['mixed'], count: result.length }
    };
  }

  if (typeof result === 'object' && result !== null) {
    // Check if it's a KDB+ table result (column-oriented)
    const columns = Object.keys(result);
    if (columns.length === 0) {
      return {
        columns: [],
        data: [],
        meta: { types: [], count: 0 }
      };
    }

    // Get first column to determine row count
    const firstColumn = result[columns[0]];
    const rowCount = Array.isArray(firstColumn) ? firstColumn.length : 1;
    
    // First pass: determine types (safe approach - trust node-q, classify strings only)  
    const types = columns.map(col => {
      const colData = result[col];
      const sampleValue = Array.isArray(colData) ? colData[0] : colData;
      
      if (typeof sampleValue === 'number') {
        // Never convert numbers - let them stay as numbers
        // Node-q already handled any necessary temporal conversions
        return 'number';
      }
      
      if (typeof sampleValue === 'string') {
        // Check for KDB+ time patterns - most specific first!
        // Check exact HH:MM:SS format first (no milliseconds)
        if (/^\d{2}:\d{2}:\d{2}$/.test(sampleValue)) {
          return 'second'; // HH:MM:SS from KDB+ second type (18h)
        }
        // Then check HH:MM:SS.mmm format  
        if (/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(sampleValue)) {
          return 'time'; // HH:MM:SS.mmm from KDB+ time type (19h)
        }
        // Finally check HH:MM format
        if (/^\d{2}:\d{2}$/.test(sampleValue)) {
          return 'minute'; // HH:MM from KDB+ minute type (17h)
        }
        if (sampleValue.includes('T')) {
          return 'datetime'; // ISO datetime
        }
        return 'string';
      }
      
      if (sampleValue instanceof Date) return 'datetime';
      return 'mixed';
    });

    // Second pass: convert to row-based format with proper type conversion
    const data = [];
    for (let i = 0; i < rowCount; i++) {
      const row = columns.map((col, colIndex) => {
        const colData = result[col];
        const value = Array.isArray(colData) ? colData[i] : colData;
        return convertKdbValue(value, col, types[colIndex]);
      });
      data.push(row);
    }

    return {
      columns,
      data,
      meta: { 
        types, 
        count: rowCount 
      }
    };
  }

  // Single value result
  return {
    columns: ['result'],
    data: [[convertKdbValue(result, 'result', 'mixed')]],
    meta: { types: ['mixed'], count: 1 }
  };
};

// Test connection endpoint
app.post('/api/connect', async (req, res) => {
  const { host, port } = req.body;
  
  try {
    await connectToKdb(host, port);
    
    res.json({ 
      success: true, 
      message: `Connected to KDB+ at ${host}:${port}`,
      connection: { host, port }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get tables endpoint
app.get('/api/tables', async (req, res) => {
  try {
    const tablesResult = await executeKdbQuery('tables[]');
    const tables = parseTableList(tablesResult);
    
    // Get metadata for each table
    const tablesWithMetadata = await Promise.all(
      tables.map(async (table) => {
        const { columns, rowCount } = await getTableMetadata(table.name);
        return {
          ...table,
          columns,
          rowCount
        };
      })
    );
    
    res.json({ 
      success: true, 
      tables: tablesWithMetadata 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      tables: [] 
    });
  }
});

// Get table data endpoint with improved pagination
app.get('/api/tables/:tableName/data', async (req, res) => {
  const { tableName } = req.params;
  const tableNameStr = toStringValue(tableName); // Ensure string for queries
  const { offset = 0, limit = 100 } = req.query;
  
  try {
    const offsetNum = parseInt(offset);
    const limitNum = parseInt(limit);
    
    // Validate parameters
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid offset parameter'
      });
    }
    
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter (must be 1-10000)'
      });
    }
    
    // Use KDB+ syntax for pagination
    // For better performance with large tables, use select statement
    const query = `select from ${tableNameStr} where i within (${offsetNum};${offsetNum + limitNum - 1})`;
    
    console.log(`Fetching ${limitNum} rows from ${tableNameStr} starting at offset ${offsetNum}`);
    const result = await executeKdbQuery(query);
    const formattedData = formatQueryResult(result);
    
    // Add pagination metadata
    const response = {
      success: true,
      data: formattedData,
      pagination: {
        offset: offsetNum,
        limit: limitNum,
        returned: formattedData.data.length
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error(`Error fetching data from ${tableNameStr}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      tableName: tableNameStr
    });
  }
});

// Execute query endpoint - simplified version
app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  
  try {
    const result = await executeKdbQuery(query);
    const formattedData = formatQueryResult(result);
    
    res.json({ 
      success: true, 
      data: formattedData 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Close KDB+ connection gracefully
  if (kdbConnection) {
    try {
      kdbConnection.close();
    } catch (e) {
      console.error('Error closing KDB+ connection:', e);
    }
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (kdbConnection) {
    try {
      kdbConnection.close();
      console.log('KDB+ connection closed');
    } catch (e) {
      console.error('Error closing KDB+ connection:', e);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (kdbConnection) {
    try {
      kdbConnection.close();
      console.log('KDB+ connection closed');
    } catch (e) {
      console.error('Error closing KDB+ connection:', e);
    }
  }
  process.exit(0);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    kdbConnection: {
      connected: !!kdbConnection,
      config: connectionConfig
    }
  };
  
  res.json(health);
});

app.listen(PORT, () => {
  console.log(`KDB+ API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/connect - Connect to KDB+ server');
  console.log('  GET  /api/tables - List tables');
  console.log('  GET  /api/tables/:name/data - Get table data');
  console.log('  POST /api/query - Execute KDB+ query');
  console.log('  GET  /api/health - Health check');
});