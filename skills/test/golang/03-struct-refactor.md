Refactor this Go struct to follow best practices. It has too many fields and mixes concerns. Split it into smaller, focused structs using composition and organize fields alphabetically.

```go
type Employee struct {
    ID            int
    Name          string
    Email         string
    Phone         string
    Street        string
    City          string
    State         string
    ZipCode       string
    Department    string
    JobTitle      string
    Salary        float64
    StartDate     string
    ManagerID     int
}
```

## Refactored

Split into focused structs by concern — each with a single responsibility, alphabetical fields, and composed into `Employee`.

```go
type Address struct {
	City    string
	State   string
	Street  string
	ZipCode string
}

type Contact struct {
	Email string
	Phone string
}

type Employment struct {
	Department string
	JobTitle   string
	ManagerID  int
	Salary     float64
	StartDate  string
}

type Employee struct {
	ID         int
	Name       string
	Address    Address
	Contact    Contact
	Employment Employment
}
```

### What changed

| Concern     | Original fields                          | New struct    |
|-------------|------------------------------------------|---------------|
| Address     | `Street`, `City`, `State`, `ZipCode`    | `Address`     |
| Contact     | `Email`, `Phone`                         | `Contact`     |
| Employment  | `Department`, `JobTitle`, `ManagerID`, `Salary`, `StartDate` | `Employment` |
| Identity    | `ID`, `Name`                             | kept inline   |

### Principles applied

- **SRP** — Each struct has one reason to change (address format, contact method, employment terms)
- **Composition over inheritance** — `Employee` composes `Address`, `Contact`, `Employment`
- **Alphabetical field ordering** — All fields sorted alphabetically within each struct
- **5–7 field limit** — No struct exceeds 5 fields (`Employment` = 5, `Employee` = 5)
