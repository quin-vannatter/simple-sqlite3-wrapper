exports.createWrapper = function(tableName, properties, db) {
    let propMap = properties.map(key => ({
        jsonKey: key,
        sqlKey: key.match(/(^[a-z]+|[A-Z][a-z]*)/g).map(value => value.toUpperCase()).join("_")
    }));
    let insertStatement = `INSERT INTO ${tableName} (${propMap.map(property => property.sqlKey).join(", ")}) VALUES (${new Array(propMap.length).fill("?").join(", ")});`;
    let updateStatement = `UPDATE ${tableName} SET ${propMap.map(property => `${property.sqlKey} = ? `).join(", ")}`;
    let removeStatement = `DELETE FROM ${tableName}`;
    let selectStatement = `SELECT ${propMap.map(property => `${property.sqlKey} ${property.jsonKey}`).join(", ")} FROM ${tableName}`;
    let formatValue = (value) => {
        if (typeof (value) === "boolean") {
            return value ? 1 : 0;
        }
        return value && value.toString() || null;
    }
    let createSqlStatement = (sql, object) => {
        let values = [];
        if (!object) {
            return {
                sql: `${sql}`,
                values
            }
        }
        return {
            sql: `${sql} WHERE ${Object.keys(object).filter(key => propMap.some(property => property.jsonKey === key)).map(key => {
                let property = propMap.find(property => property.jsonKey ===  key);
                if (object[key] != undefined) {
                    values.push(formatValue(object[key]));
                    return `${property.sqlKey} = ?`;
                } else {
                    return `${property.sqlKey} IS NULL`;
                }
            }).join(" AND ")};`,
            values
        };
    }
    let getValues = object => propMap.map(property => formatValue(object[property.jsonKey]));
    let newWrapper = {
        findOne: (search) => {
            try
            {
                return new Promise(resolve => {
                    newWrapper.find(search).then(rows => resolve(rows.length ? rows[0] : null));
                });
            }
            catch {
                return Promise.resolve(null)
            }
        },
        find: (search) => {
            try {
                return new Promise(resolve => {
                    let params = createSqlStatement(selectStatement, search);
                    db.all(params.sql, params.values, (err, rows) => {
                        if (err) {
                            console.error(err);
                        }
                        resolve(rows);
                    });
                });
            }
            catch {
                return Promise.resolve([]);
            }
        },
        create: (object) => {
            try {
                return new Promise(resolve => {
                    let values = getValues(object);
                    db.run(insertStatement, values, err => {
                        if (err) {
                            console.error(err);
                        }
                        resolve();
                    });
                });
            } catch {
                return Promise.resolve();
            }
        },
        update: (object, search) => {
            try {
                return new Promise(resolve => {
                    let values = getValues(object);
                    let params = createSqlStatement(updateStatement, search);
                    db.run(params.sql, values.concat(params.values), err => {
                        if (err) {
                            console.error(err);
                        }
                        resolve();
                    })
                });
            } catch {
                return Promise.resolve();
            }
        },
        delete: (search) => {
            try {
                return new Promise(resolve => {
                    let params = createSqlStatement(removeStatement, search);
                    db.run(params.sql, params.values, err => {
                        if (err) {
                            console.error(err);
                        }
                        resolve();
                    });
                });
            } catch {
                return Promise.resolve();
            }
        }
    }
    return newWrapper;
}