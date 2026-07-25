from __future__ import annotations

from datetime import date
from typing import List, Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.tds_head_payment import TdsHeadPayment
from app.schemas.tally import TdsHeadPaymentOut

MAX_PDF_BYTES = 1 * 1024 * 1024
ALLOWED_PDF_TYPES = {"application/pdf"}


def _to_out(row: TdsHeadPayment) -> TdsHeadPaymentOut:
    has_pdf = bool(row.pdf_data) and (row.pdf_size or 0) > 0
    return TdsHeadPaymentOut(
        fy_start=row.fy_start,
        month=row.month,
        tds_head=row.tds_head,
        payment_date=row.payment_date,
        has_pdf=has_pdf,
        pdf_filename=row.pdf_filename if has_pdf else None,
        pdf_size=row.pdf_size if has_pdf else None,
    )


def _get_or_create(
    db: Session,
    *,
    fy_start: int,
    month: int,
    tds_head: str,
) -> TdsHeadPayment:
    head = (tds_head or "").strip()
    row = (
        db.query(TdsHeadPayment)
        .filter(
            TdsHeadPayment.fy_start == int(fy_start),
            TdsHeadPayment.month == int(month),
            TdsHeadPayment.tds_head == head,
        )
        .first()
    )
    if row:
        return row
    row = TdsHeadPayment(
        fy_start=int(fy_start),
        month=int(month),
        tds_head=head,
    )
    db.add(row)
    db.flush()
    return row


def list_payments(
    db: Session,
    *,
    fy_start: int,
    month: int,
) -> List[TdsHeadPaymentOut]:
    rows = (
        db.query(TdsHeadPayment)
        .filter(
            TdsHeadPayment.fy_start == int(fy_start),
            TdsHeadPayment.month == int(month),
        )
        .order_by(TdsHeadPayment.tds_head.asc())
        .all()
    )
    return [_to_out(row) for row in rows]


def update_payment_date(
    db: Session,
    *,
    fy_start: int,
    month: int,
    tds_head: str,
    payment_date: Optional[date],
) -> TdsHeadPaymentOut:
    row = _get_or_create(
        db,
        fy_start=fy_start,
        month=month,
        tds_head=tds_head,
    )
    row.payment_date = payment_date
    db.commit()
    db.refresh(row)
    return _to_out(row)


def upload_payment_pdf(
    db: Session,
    *,
    fy_start: int,
    month: int,
    tds_head: str,
    file: UploadFile,
) -> TdsHeadPaymentOut:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    filename = (file.filename or "").strip() or "payment.pdf"
    if content_type not in ALLOWED_PDF_TYPES and not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a PDF file.",
        )

    contents = file.file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected file is empty.",
        )
    if len(contents) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF must be 1 MB or smaller.",
        )
    if not contents.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a valid PDF file.",
        )

    row = _get_or_create(
        db,
        fy_start=fy_start,
        month=month,
        tds_head=tds_head,
    )
    row.pdf_data = contents
    row.pdf_filename = filename[:255]
    row.pdf_content_type = "application/pdf"
    row.pdf_size = len(contents)
    db.commit()
    db.refresh(row)
    return _to_out(row)


def get_payment_pdf(
    db: Session,
    *,
    fy_start: int,
    month: int,
    tds_head: str,
) -> Tuple[bytes, str, str]:
    head = (tds_head or "").strip()
    row = (
        db.query(TdsHeadPayment)
        .filter(
            TdsHeadPayment.fy_start == int(fy_start),
            TdsHeadPayment.month == int(month),
            TdsHeadPayment.tds_head == head,
        )
        .first()
    )
    if not row or not row.pdf_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment PDF not found",
        )
    filename = row.pdf_filename or "payment.pdf"
    content_type = row.pdf_content_type or "application/pdf"
    return row.pdf_data, filename, content_type


def delete_payment_pdf(
    db: Session,
    *,
    fy_start: int,
    month: int,
    tds_head: str,
) -> TdsHeadPaymentOut:
    head = (tds_head or "").strip()
    row = (
        db.query(TdsHeadPayment)
        .filter(
            TdsHeadPayment.fy_start == int(fy_start),
            TdsHeadPayment.month == int(month),
            TdsHeadPayment.tds_head == head,
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment record not found",
        )
    row.pdf_data = None
    row.pdf_filename = None
    row.pdf_content_type = None
    row.pdf_size = None
    db.commit()
    db.refresh(row)
    return _to_out(row)
