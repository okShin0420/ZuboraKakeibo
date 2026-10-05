package jp.zubora.kakeibo.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "holidays")
public class HolidayEntity {
    @Id
    @Column(name = "holiday_date", length = 10)
    private String holidayDate;
    @Column(name = "calendar_year", nullable = false)
    private Short calendarYear;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(nullable = false, length = 255)
    private String source;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public HolidayEntity() {}

    public String getHolidayDate() { return holidayDate; }
    public void setHolidayDate(String holidayDate) { this.holidayDate = holidayDate; }
    public Short getCalendarYear() { return calendarYear; }
    public void setCalendarYear(Short calendarYear) { this.calendarYear = calendarYear; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
