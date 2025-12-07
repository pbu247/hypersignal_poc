import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    type?: 'bar' | 'line';
  }>;
  chart_type?: 'bar' | 'line' | 'pie' | 'combo' | 'area';
}

interface ChartViewProps {
  data: ChartData;
  type?: 'bar' | 'line' | 'pie' | 'combo' | 'area';
}

const ChartView: React.FC<ChartViewProps> = ({ data, type }) => {
  // 백엔드에서 지정한 타입 우선 사용
  const chartType = type || data.chart_type || 'bar';
  
  const gradientColors = [
    { start: 'rgba(99, 102, 241, 0.8)', end: 'rgba(99, 102, 241, 0.2)', border: 'rgb(99, 102, 241)' },     // indigo
    { start: 'rgba(139, 92, 246, 0.8)', end: 'rgba(139, 92, 246, 0.2)', border: 'rgb(139, 92, 246)' },    // purple
    { start: 'rgba(236, 72, 153, 0.8)', end: 'rgba(236, 72, 153, 0.2)', border: 'rgb(236, 72, 153)' },    // pink
    { start: 'rgba(59, 130, 246, 0.8)', end: 'rgba(59, 130, 246, 0.2)', border: 'rgb(59, 130, 246)' },    // blue
    { start: 'rgba(16, 185, 129, 0.8)', end: 'rgba(16, 185, 129, 0.2)', border: 'rgb(16, 185, 129)' },    // emerald
    { start: 'rgba(245, 158, 11, 0.8)', end: 'rgba(245, 158, 11, 0.2)', border: 'rgb(245, 158, 11)' },    // amber
  ];

  const pieColors = [
    'rgba(99, 102, 241, 0.9)',
    'rgba(139, 92, 246, 0.9)',
    'rgba(236, 72, 153, 0.9)',
    'rgba(59, 130, 246, 0.9)',
    'rgba(16, 185, 129, 0.9)',
    'rgba(245, 158, 11, 0.9)',
    'rgba(239, 68, 68, 0.9)',
    'rgba(34, 197, 94, 0.9)',
    'rgba(251, 191, 36, 0.9)',
    'rgba(168, 85, 247, 0.9)',
  ];

  const createGradient = (ctx: CanvasRenderingContext2D, colorScheme: typeof gradientColors[0], chartArea: any) => {
    if (!chartArea) return colorScheme.start;
    
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, colorScheme.end);
    gradient.addColorStop(1, colorScheme.start);
    return gradient;
  };

  const chartData = {
    labels: data.labels,
    datasets: data.datasets.map((dataset, index) => {
      const colorScheme = gradientColors[index % gradientColors.length];
      const baseConfig: any = {
        label: dataset.label,
        data: dataset.data,
        borderWidth: 2.5,
        tension: 0.4,
      };

      // Combo 차트인 경우 dataset별 타입 사용
      if (chartType === 'combo' && dataset.type) {
        baseConfig.type = dataset.type;
      }

      if (chartType === 'pie') {
        baseConfig.backgroundColor = pieColors.slice(0, data.labels.length);
        baseConfig.borderColor = 'rgba(255, 255, 255, 0.8)';
        baseConfig.borderWidth = 2;
      } else if (chartType === 'area') {
        baseConfig.fill = true;
        baseConfig.backgroundColor = (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return colorScheme.start;
          return createGradient(ctx, colorScheme, chartArea);
        };
        baseConfig.borderColor = colorScheme.border;
        baseConfig.pointBackgroundColor = colorScheme.border;
        baseConfig.pointBorderColor = '#fff';
        baseConfig.pointBorderWidth = 2;
        baseConfig.pointRadius = 4;
        baseConfig.pointHoverRadius = 6;
      } else if (chartType === 'line' || (chartType === 'combo' && dataset.type === 'line')) {
        baseConfig.backgroundColor = colorScheme.border;
        baseConfig.borderColor = colorScheme.border;
        baseConfig.pointBackgroundColor = colorScheme.border;
        baseConfig.pointBorderColor = '#fff';
        baseConfig.pointBorderWidth = 2;
        baseConfig.pointRadius = 4;
        baseConfig.pointHoverRadius = 6;
      } else {
        // bar 차트
        baseConfig.backgroundColor = (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return colorScheme.start;
          return createGradient(ctx, colorScheme, chartArea);
        };
        baseConfig.borderColor = colorScheme.border;
        baseConfig.borderRadius = 6;
        baseConfig.borderSkipped = false;
      }

      return baseConfig;
    }),
  };

  const maxLabelLength = Math.max(...data.labels.map(l => l.length));
  const shouldRotateLabels = maxLabelLength > 8 || data.labels.length > 10;

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'var(--text)',
          padding: 15,
          font: {
            size: 12,
            weight: '500',
          },
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: {
          size: 13,
          weight: '600',
        },
        bodyFont: {
          size: 12,
        },
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('ko-KR').format(context.parsed.y);
            } else if (context.parsed !== null) {
              label += new Intl.NumberFormat('ko-KR').format(context.parsed);
            }
            return label;
          }
        }
      },
    },
  };

  if (chartType !== 'pie') {
    options.scales = {
      x: {
        ticks: {
          color: 'var(--text-secondary)',
          font: {
            size: 11,
          },
          maxRotation: shouldRotateLabels ? 45 : 0,
          minRotation: shouldRotateLabels ? 45 : 0,
          autoSkip: true,
          maxTicksLimit: 15,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: 'var(--text-secondary)',
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return new Intl.NumberFormat('ko-KR').format(value);
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
      },
    };
  } else {
    options.plugins.legend.position = 'right';
    options.plugins.tooltip.callbacks = {
      label: function(context: any) {
        const label = context.label || '';
        const value = context.parsed;
        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
        const percentage = ((value / total) * 100).toFixed(1);
        return `${label}: ${new Intl.NumberFormat('ko-KR').format(value)} (${percentage}%)`;
      }
    };
  }

  const chartHeight = chartType === 'pie' ? '450px' : shouldRotateLabels ? '500px' : '450px';

  return (
    <div 
      className="w-full rounded-lg p-6"
      style={{
        height: chartHeight,
        background: '#ffffff',
      }}
    >
      {(chartType === 'bar' || chartType === 'combo') && <Bar data={chartData} options={options} />}
      {(chartType === 'line' || chartType === 'area') && <Line data={chartData} options={options} />}
      {chartType === 'pie' && <Pie data={chartData} options={options} />}
    </div>
  );
};

export default ChartView;
