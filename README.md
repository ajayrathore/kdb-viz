# KDB+ Visualizer

A modern, responsive web-based GUI for KDB+ database visualization and analysis. Built with React, TypeScript, and Plotly.js for seamless data exploration and visualization.

![KDB+ Visualizer](https://img.shields.io/badge/KDB+-Visualizer-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)
![Plotly.js](https://img.shields.io/badge/Plotly.js-Latest-239120?style=flat&logo=plotly)

## 🌟 Features

### 📊 **Data Visualization**
- **Interactive Charts**: Line, bar, scatter, histogram, and area charts
- **Real-time Data**: Connect directly to live KDB+ processes
- **Responsive Design**: Resizable charts with optimal label density
- **Clean Interface**: Grid-free charts with proper axis spacing
- **Dark/Light Modes**: System-aware theme switching

### 🗃️ **Database Management**
- **Table Browser**: Navigate all tables in your KDB+ database with search functionality
- **Virtual Data Grid**: High-performance grid with virtual scrolling for large datasets
- **Query Executor**: Run custom KDB+ queries with clean, simple interface
- **Real-time Results**: Instant query execution and result display
- **Column Management**: Show/hide and reorder columns dynamically

### 🎨 **User Experience**
- **Modern UI**: Built with Tailwind CSS and custom UI components
- **Full-screen Charts**: Expandable chart modals for detailed analysis
- **Keyboard Shortcuts**: ESC to close modals, intuitive navigation
- **Responsive Layout**: Works on desktop, tablet, and mobile devices
- **Loading Animation**: Professional animated loading screen
- **Resizable Panels**: Adjustable layout with react-resizable-panels

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **KDB+ Server** running and accessible

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kdb-viz
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development servers**

   **Option 1** - Run both together:
   ```bash
   npm run dev:full
   ```

   **Option 2** - Run separately:
   ```bash
   # Terminal 1: Frontend (React)
   npm run dev

   # Terminal 2: Backend API (Express)
   npm run server
   ```

4. **Access the application**
   - Frontend: http://localhost:5173 (Vite default port)
   - API Server: http://localhost:3001

## 🔧 Configuration

### KDB+ Connection

The application connects to your KDB+ server through the API backend. Configure your connection details in the web interface:

- **Host**: Your KDB+ server hostname/IP (default: localhost)
- **Port**: Your KDB+ server port (default: 5000)

### Environment Variables

Create a `.env` file in the root directory for custom configuration:

```env
# API Server Configuration
API_PORT=3001
KDB_DEFAULT_HOST=localhost
KDB_DEFAULT_PORT=5000

# Frontend Configuration (optional - defaults work out of box)
VITE_API_URL=http://localhost:3001
```

## 📖 Usage Guide

### 1. **Connecting to KDB+**

1. Launch the application at http://localhost:5173
2. Enter your KDB+ server details:
   - **Host**: Server hostname or IP address
   - **Port**: KDB+ server port number
3. Click **"Connect"** to establish connection

### 2. **Exploring Tables**

- **Left Sidebar**: Browse all available tables
- **Click any table**: View table data with pagination
- **Navigation**: Use Previous/Next buttons for large datasets
- **Auto-loading**: First table loads automatically on connection

### 3. **Running Queries**

- **Query Bar**: Located at the top of the dashboard
- **Syntax**: Use standard KDB+ q syntax
- **Execute**: Click the play button or press Enter
- **Results**: Display immediately in the data grid

**Example Queries:**
```q
// Select first 100 rows from trade table
select[100] from trade

// Get price statistics
select avg price, max price, min price by sym from trade

// Time-based filtering
select from trade where date=2024.01.15, time within 09:30:00 16:00:00
```

### 4. **Creating Visualizations**

1. **Load Data**: Either select a table or run a query
2. **Open Chart**: Click the **"Open Chart"** button in the header
3. **Configure Chart**:
   - **Chart Type**: Choose from line, bar, scatter, histogram, or area
   - **X-Axis**: Select column for horizontal axis
   - **Y-Axis**: Select column for vertical axis
   - **Title**: Customize chart title
4. **Interact**:
   - **Resize**: Drag the bottom-right corner to resize
   - **Settings**: Toggle chart controls on/off
   - **Close**: Press ESC or click the X button

### 5. **Chart Types**

| Type | Best For | Description |
|------|----------|-------------|
| **Line** | Time series, trends | Connected data points with markers |
| **Bar** | Categories, comparisons | Vertical bars for discrete data |
| **Scatter** | Correlations, distributions | Individual data points |
| **Histogram** | Frequency distributions | Binned data frequency |
| **Area** | Cumulative data, filled regions | Line chart with filled area |

### 6. **Additional Features**

- **Column Management**: Show/hide and reorder columns in the data grid
- **Virtual Scrolling**: Efficiently handle large datasets with smooth scrolling
- **Loading Animation**: Professional loading screen with KDB+ themed animation
- **Resizable Panels**: Adjust the size of sidebar and main content areas
- **Theme Persistence**: Theme preference saved to local storage

## 🏗️ Architecture

### Frontend Stack
- **React 18**: Modern React with hooks and context
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **Plotly.js**: Interactive data visualization
- **TanStack Virtual**: Virtual scrolling for performance
- **React Resizable Panels**: Flexible layout management
- **Radix UI**: Accessible UI primitives (dropdown menu)
- **Lucide React**: Modern icon library
- **Zustand**: Lightweight state management

### Backend Stack
- **Express.js**: RESTful API server
- **node-q**: KDB+ connectivity library
- **CORS**: Cross-origin resource sharing
- **Error Handling**: Comprehensive error management

### File Structure
```
kdb-viz/
├── src/
│   ├── components/              # React components
│   │   ├── ui/                 # UI base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   └── input.tsx
│   │   ├── chart-modal-plotly.tsx
│   │   ├── column-management-modal.tsx
│   │   ├── connection-input.tsx
│   │   ├── loading-screen.tsx
│   │   ├── query-executor-simple.tsx
│   │   ├── table-sidebar.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── virtual-data-grid.tsx
│   │   └── visualization-panel.tsx
│   ├── contexts/               # React contexts
│   │   └── theme-context.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-app-loader.ts
│   │   └── use-kdb-connection.ts
│   ├── pages/                  # Page components
│   │   └── dashboard-page.tsx
│   ├── services/               # API services
│   │   └── kdb-api.ts
│   ├── types/                  # TypeScript definitions
│   │   ├── kdb.ts
│   │   └── plotly.d.ts
│   ├── lib/                    # Utilities
│   │   └── utils.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── vite.svg               # Default favicon
├── tests/
│   └── connection.spec.ts     # E2E tests
├── dist/                      # Build output
├── server.js                  # Express API server
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── playwright.config.ts
└── README.md
```

## 🔍 Troubleshooting

### Common Issues

**1. Connection Failed**
```
Error: Cannot connect to KDB+ server
```
- Verify KDB+ server is running
- Check host/port configuration
- Ensure firewall allows connections
- Confirm KDB+ process accepts external connections

**2. Charts Not Displaying**
```
Error creating visualization
```
- Ensure data contains numeric columns
- Check for null/undefined values in data
- Verify column selection in chart settings
- Try different chart types

**3. Query Execution Errors**
```
Query execution failed
```
- Validate q syntax
- Check table/column names exist
- Ensure proper permissions
- Review KDB+ server logs

**4. Performance Issues**
- **Large Datasets**: Use pagination and LIMIT clauses
- **Slow Queries**: Add appropriate indices to KDB+ tables
- **Memory Usage**: Close unused chart modals
- **Network**: Check connection stability

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=kdb-viz:* npm run server
```

## 🛠️ Development

### Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development mode**
   ```bash
   # Option 1: Run both frontend and backend together
   npm run dev:full

   # Option 2: Run separately
   # Terminal 1: Frontend with hot reload
   npm run dev

   # Terminal 2: Backend server
   npm run server
   ```

3. **Linting**
   ```bash
   npm run lint
   ```

4. **Testing**
   ```bash
   # Unit tests
   npm run test

   # E2E tests
   npm run test:e2e
   ```

### Building for Production

```bash
npm run build
npm run preview
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/connect` | Connect to KDB+ server |
| GET | `/api/tables` | List all available tables |
| GET | `/api/table/:name` | Get table data with pagination |
| POST | `/api/query` | Execute custom KDB+ query |
| GET | `/api/disconnect` | Disconnect from KDB+ server |

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Code Style

- Use TypeScript for all new code
- Follow React hooks patterns
- Implement proper error handling
- Add JSDoc comments for complex functions
- Use semantic commit messages

## 📋 Requirements

### System Requirements
- **Operating System**: Windows, macOS, or Linux
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: 500MB free space
- **Network**: Access to KDB+ server

### Browser Compatibility
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **KX Systems** for KDB+ database technology
- **Plotly.js** team for excellent visualization library
- **TanStack** for virtual scrolling solutions
- **React** and **TypeScript** communities
- **Tailwind CSS** for utility-first styling

## 📞 Support

For support and questions:

1. **Check Documentation**: Review this README and inline comments
2. **Search Issues**: Look through existing GitHub issues
3. **Create Issue**: Open a new issue with detailed description
4. **Community**: Join discussions in GitHub Discussions

---

**Built with ❤️ for the KDB+ community**

*KDB+ Visualizer - Making time-series data analysis beautiful and intuitive.*