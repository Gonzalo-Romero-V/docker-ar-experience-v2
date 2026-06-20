import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
  highlightColumn?: number;
}

function ComparisonTable({ headers, rows, highlightColumn }: ComparisonTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header, i) => (
            <TableHead
              key={i}
              className={cn(i === highlightColumn && 'text-primary font-semibold')}
            >
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, ri) => (
          <TableRow key={ri}>
            {row.map((cell, ci) => (
              <TableCell
                key={ci}
                className={cn(ci === highlightColumn && 'text-primary font-medium')}
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { ComparisonTable };
export type { ComparisonTableProps };
