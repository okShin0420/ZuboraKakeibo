package jp.zubora.kakeibo.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "holiday_calendar_coverage")
public class HolidayCalendarCoverageEntity {
    @Id
    @Column(name = "calendar_year")
    private Short calendarYear;
    @Column(nullable = false, length = 255)
    private String source;
    @Column(name = "imported_at", nullable = false)
    private Instant importedAt;

    public HolidayCalendarCoverageEntity() {}

    public Short getCalendarYear() { return calendarYear; }
    public void setCalendarYear(Short calendarYear) { this.calendarYear = calendarYear; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Instant getImportedAt() { return importedAt; }
    public void setImportedAt(Instant importedAt) { this.importedAt = importedAt; }
}
