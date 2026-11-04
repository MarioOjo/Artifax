import React, { FC, useEffect, useState } from 'react';
import './historyStats.css';
import inventoryIcon from '../../../../assets/images/inventoryIcon.png';
import inventoryIconWhite from '../../../../assets/images/inventoryIconWhite.png';
import cancelledIcon from '../../../../assets/images/cancelledIcon.png';
import cancelledIconWhite from '../../../../assets/images/cancelledIconWhite.png';
import completedIcon from '../../../../assets/images/completeIcon.png';
import completedIconWhite from '../../../../assets/images/completeIconWhite.png';
import avgDurationIcon from '../../../../assets/images/durationIcon.png';
import avgDurationIconWhite from '../../../../assets/images/durationIconWhite.png';
import { useApi, useThemeAwareIcon } from '../../../../hooks';

interface OrderDto {
  orderID: number;
  quantity: number;
  status: string;
  createdDateTime?: string | null;
  completedDateTime?: string | null;
}

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
};

const HistoryStats: FC = () => {
  const api = useApi();
  const totalJobsIconSrc = useThemeAwareIcon(inventoryIcon, inventoryIconWhite);
  const cancelledIconSrc = useThemeAwareIcon(cancelledIcon, cancelledIconWhite);
  const completedIconSrc = useThemeAwareIcon(completedIcon, completedIconWhite);
  const avgDurationIconSrc = useThemeAwareIcon(avgDurationIcon, avgDurationIconWhite);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [cancelledItems, setCancelledItems] = useState<number>(0);
  const [completedItems, setCompletedItems] = useState<number>(0);
  const [avgDuration, setAvgDuration] = useState<string>('N/A');

  useEffect(() => {
    const loadStats = async (): Promise<void> => {
      try {
        const response = await api.get<OrderDto[]>('/Order');
        const orders = response.data || [];

        // Cancelled: sum of quantities for cancelled orders
        const cancelledSum = orders
          .filter((o) => (o.status || '').toLowerCase() === 'cancelled')
          .reduce((sum, o) => sum + (o.quantity || 0), 0);

        // Completed: sum of quantities for completed orders
        const completedSum = orders
          .filter((o) => (o.status || '').toLowerCase() === 'complete' || (o.status || '').toLowerCase() === 'completed')
          .reduce((sum, o) => sum + (o.quantity || 0), 0);

        // Avg Duration: average minutes between created and completed for completed orders
        const durations: number[] = orders
          .filter((o) => (o.status || '').toLowerCase() === 'complete' || (o.status || '').toLowerCase() === 'completed')
          .map((o) => {
            if (!o.createdDateTime || !o.completedDateTime) return 0;
            const start = new Date(o.createdDateTime).getTime();
            const end = new Date(o.completedDateTime).getTime();
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
            return (end - start) / 60000; // minutes
          })
          .filter((m) => m > 0);

        const avgMin = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        // Total Jobs: every order, whatever its status
        setTotalJobs(orders.length);
        setCancelledItems(cancelledSum);
        setCompletedItems(completedSum);
        setAvgDuration(durations.length ? formatDuration(avgMin) : 'N/A');
      } catch (err) {
        // Keep defaults on error
        console.error('Failed to load history stats', err);
      }
    };

    void loadStats();
  }, [api]);

  const stats = [
    { label: 'Total Jobs', value: String(totalJobs), icon: <img src={totalJobsIconSrc} alt="Total Jobs" /> },
    { label: 'Cancelled', value: String(cancelledItems), icon: <img src={cancelledIconSrc} alt="Cancelled" /> },
    { label: 'Completed', value: String(completedItems), icon: <img src={completedIconSrc} alt="Completed" /> },
    { label: 'Avg Duration', value: avgDuration, icon: <img src={avgDurationIconSrc} alt="Avg Duration" /> },
  ];

  return (
    <div className="history-stats-container">
      {stats.map((stat, index) => (
        <div key={index} className="history-card">
          <div className="history-icon-wrapper">{stat.icon}</div>
          <div className="history-text-wrapper">
            <span className="history-label">{stat.label}</span>
            <span className="history-value">{stat.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryStats;
