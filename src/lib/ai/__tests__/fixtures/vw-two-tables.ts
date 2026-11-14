// Made-up VW-style bill (values invented): "S." / "No." serial heading, a labour table then a parts table on one page,
// a CGST/SGST line under each row. The built-in rules do not read it; a learned layout does.
import type { PdfToken } from '../../row-parser';

const line = (y: number, cells: Array<[number, string]>): PdfToken[] =>
  cells.map(([x, s]) => ({ s, x, y, w: s.length * 5 }));

export const labourHead = [...line(319, [[43, 'S.'], [415, 'GST'], [435, 'Base'], [543, 'Amount']]), ...line(315, [[105, 'Description'], [302, 'SAC'], [344, 'Qty.']]), ...line(310, [[42, 'No.'], [420, 'Amount'], [543, 'Incl.'], [565, 'Tax']])];
export const partsHead = [...line(151, [[41, 'S.'], [341, 'Unit'], [415, 'GST'], [435, 'Base'], [542, 'Amount']]), ...line(147, [[83, 'Description'], [166, 'Part'], [186, 'No.'], [262, 'HSN'], [304, 'Qty.']]), ...line(142, [[340, 'Price'], [419, 'Amount'], [542, 'Incl.'], [565, 'Tax']])];
export const page = [
  ...line(333, [[68, 'Labor'], [98, 'Details']]), ...labourHead,
  ...line(297, [[46, '1'], [60, 'DENTING'], [293, '00998729'], [353, '1.00'], [433, '100.00'], [546, '118.00']]),
  ...line(284, [[58, 'CGST'], [80, '-'], [90, '9.00%'], [120, '9.00,'], [157, 'SGST'], [180, '9.00']]),
  ...line(271, [[46, '2'], [60, 'REFITTING'], [293, '00998729'], [353, '1.00'], [433, '200.00'], [546, '236.00']]),
  ...line(219, [[433, 'Total'], [460, 'Labor'], [546, '354.00']]),
  ...line(165, [[68, 'Parts'], [98, 'Details']]), ...partsHead,
  ...line(125, [[43, '1'], [58, 'HOOD'], [157, '6R0823031G'], [252, '87089900'], [313, '1.00'], [337, '50.00'], [424, '50.00'], [546, '59.00']]),
  ...line(107, [[55, 'CGST'], [90, '9.00%'], [165, 'SGST'], [190, '4.50']]),
  ...line(94, [[43, '2'], [58, 'FENDER'], [157, '6RG821106J'], [252, '87089900'], [313, '2.00'], [337, '25.00'], [424, '50.00'], [546, '59.00']]),
  ...line(60, [[434, 'Total'], [460, 'Parts'], [546, '118.00']]),
  ...line(40, [[344, 'Final'], [375, 'Amount'], [546, '472.00']]),
];
