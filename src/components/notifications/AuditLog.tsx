import { useState, useEffect } from 'react';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 30;

  useEffect(() => { loadLogs(); }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({ page: page.toString(), limit: limit.toString() });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {} finally { setLoading(false); }
  };

  const totalPages = Math.ceil(total / limit);

  const getActionVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' => {
    switch (action) {
      case 'login': return 'success';
      case 'create': return 'default';
      case 'update': return 'warning';
      case 'delete': return 'destructive';
      case 'report': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Track all system activity and changes ({total} records)</p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="max-w-md">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-500">No audit logs found</TableCell>
              </TableRow>
            ) : logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="font-medium">{log.full_name || log.username}</TableCell>
                <TableCell>
                  <Badge variant={getActionVariant(log.action)} className="rounded-full capitalize">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600">
                  <span className="text-xs font-medium text-gray-400">{log.entity_type}</span>
                  {log.entity_id && <span className="text-gray-600"> #{log.entity_id}</span>}
                </TableCell>
                <TableCell className="text-gray-500 max-w-md truncate text-xs">{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
