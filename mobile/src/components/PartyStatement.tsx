import { ComponentRef, Ref } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Bill } from '../lib/api';
import { dmy, formatValue } from '../lib/format';

// Mirrors frontend/src/utils/copyReceivablesImage.js so a copy from the app looks the same
// as a copy from the web app when pasted into WhatsApp. Keep the two in step.
const PAD_X = 16;
const PAD_Y = 14;
const ROW_H = 22;
const COMPANY_H = 30;
const SUBTITLE_H = 20;
const COLS = [
  { width: 118, align: 'left' },
  { width: 108, align: 'left' },
  { width: 118, align: 'right' },
  { width: 52, align: 'right' },
] as const;
const TABLE_W = COLS.reduce((sum, c) => sum + c.width, 0);

const COLORS = {
  bg: '#ffffff',
  ink: '#1a1a1a',
  muted: '#555555',
  line: '#b0b0b0',
  partyBg: '#e8e8e8',
  subtotalBg: '#f7f7f7',
  overdueBg: '#fde8d8',
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export type StatementRef = ComponentRef<typeof View>;

type Props = {
  ref?: Ref<StatementRef>;
  companyName: string;
  ledgerName: string;
  bills: Bill[];
  total: number;
  asOf?: Date;
};

/** White, Excel-style statement for one party, rendered off-screen and captured as a PNG. */
export function PartyStatement({ ref, companyName, ledgerName, bills, total, asOf = new Date() }: Props) {
  const company = companyName.trim();
  return (
    <View ref={ref} collapsable={false} style={s.page}>
      {company ? (
        <Text style={[s.text, s.company]} numberOfLines={1}>
          {company}
        </Text>
      ) : null}
      <Text style={[s.text, s.subtitle]} numberOfLines={1}>
        Debitors Receivable as on {dmy(asOf)}
      </Text>

      <View style={s.table}>
        <View style={[s.row, { backgroundColor: COLORS.partyBg }]}>
          <Text style={[s.text, s.bold, s.partyName]} numberOfLines={1}>
            {ledgerName}
          </Text>
        </View>

        {bills.map((bill, i) => {
          const overdue = bill.days != null && bill.days > 30;
          const cells = [
            bill.invoice_no ?? '',
            dmy(bill.invoice_date),
            formatValue(bill.amount),
            bill.days == null ? '' : String(bill.days),
          ];
          return (
            <View key={i} style={[s.row, overdue && { backgroundColor: COLORS.overdueBg }]}>
              {COLS.map((col, idx) => (
                <Text
                  key={idx}
                  numberOfLines={1}
                  style={[s.text, s.cell, { width: col.width, textAlign: col.align }]}
                >
                  {cells[idx]}
                </Text>
              ))}
            </View>
          );
        })}

        <View style={[s.row, s.lastRow, { backgroundColor: COLORS.subtotalBg }]}>
          <Text style={[s.text, s.bold, s.cell, { width: COLS[0].width + COLS[1].width }]}>Sub total</Text>
          <Text style={[s.text, s.bold, s.cell, { width: COLS[2].width, textAlign: 'right' }]}>
            {formatValue(total)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    width: TABLE_W + PAD_X * 2,
    backgroundColor: COLORS.bg,
    paddingHorizontal: PAD_X,
    paddingVertical: PAD_Y,
  },
  text: { fontFamily: MONO, fontSize: 12, color: COLORS.ink },
  bold: { fontWeight: '600' },
  company: { height: COMPANY_H, lineHeight: COMPANY_H, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  subtitle: { height: SUBTITLE_H, lineHeight: SUBTITLE_H, color: COLORS.muted, textAlign: 'center', marginBottom: 8 },
  table: { width: TABLE_W, borderWidth: 1, borderColor: COLORS.line },
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  lastRow: { borderBottomWidth: 0 },
  partyName: { paddingHorizontal: 8, flex: 1 },
  cell: { paddingHorizontal: 8 },
});
