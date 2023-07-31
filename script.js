const data_file = "data.csv"
const parameters = {
    state: null,
    topic: null,
    demographic: null,
    question: null
}
let data;

const getColumnData = (data, columnName) => {
    return data.map(row => row[columnName]).filter(Boolean);
}

const getUniqueColumnData = (data, columnName) => {
    return Array.from(new Set(getColumnData(data, columnName))).sort();
}

const getFilteredData = (data, columnName, columnValue) => {
    return data.filter(row => row[columnName] === columnValue);
}

const addDropDownList = (listName, id, listElements) => {
    let label = document.createElement("label");
    label.innerHTML = listName;
    label.htmlFor = id;

    let select = document.createElement("select");
    select.id = id;
    select.defaultValue = select.options[0];
    listElements.forEach(listElement => {
        let option = document.createElement("option");
        option.value = listElement;
        option.text = listElement;
        if (id === "state" && listElement === "US") {
            option.selected = true;
        }
        select.add(option);
    });
    parameters[id] = select.options[select.selectedIndex].value
    select.addEventListener("change", () => {
        parameters[id] = select.options[select.selectedIndex].value
        lineChart(data);
    })

    let parent = document.getElementById(id + "-list-row");
    parent.appendChild(label);
    parent.appendChild(select);
}

const removeList = (id) => {
    let parent = document.getElementById(id + "-list-row");
    let label = document.getElementById(id + "-list-label");
    let div = document.getElementById(id + "-list");
    label !== null ? parent.removeChild(label) : null;
    div !== null ? parent.removeChild(div) : null;
}

const addList = (listName, id, listElements, getData) => {
    if (listElements.length === 0) {
        return;
    }

    let parentId = id + "-list-row";

    let label = document.createElement("label");
    label.id = id + "-list-label";
    label.innerHTML = listName;
    label.htmlFor = id + "-list";

    let ul = document.createElement("ul");
    ul.classList.add("list");
    ul.id = id + "-list";
    listElements.forEach(listElement => {
        let li = document.createElement("li");
        li.classList.add("list-item")
        li.innerHTML = listElement;
        li.onclick = () => {
            let isAlreadySelected = li.classList.contains("selected");
            let listItems = ul.getElementsByClassName("list-item");
            [...listItems].forEach(item => {
                item.classList.remove("selected");
            })

            if (isAlreadySelected) {
                li.classList.remove("selected");
                parameters[id] = null;
                if (id === "topic") {
                    removeList("question");
                }
                lineChart(data);
            }
            else {
                li.classList.add("selected");
                parameters[id] = li.innerHTML;
                if (id === "topic") {
                    removeList("question");
                    addList("Question", "question", getData(listElement));
                }
                lineChart(data);
            }
        };

        ul.appendChild(li);
    });

    let parent = document.getElementById(parentId);
    parent.appendChild(label);
    parent.appendChild(ul);

    // select default list item and dispatch click event
    let elementToBeSelected;
    if (id == "topic") {
        elementToBeSelected = ul.querySelector(".list-item:last-child");
    }
    else {
        elementToBeSelected = ul.querySelector(".list-item:first-child");
    }
    const event = new Event("click");
    elementToBeSelected.dispatchEvent(event);
}

const cleanElement = (id) => {
    let el = document.getElementById(id);
    if (el !== null) {
        el.remove();
    }
};

const warningAlert = () => {
    let div = document.getElementById("warning-alert");
    let childDiv = document.createElement("div")
    childDiv.id = "warning"
    childDiv.innerHTML = "Please select all the parameters";
    div.appendChild(childDiv);
}

const lineChart = (data) => {

    // determine width and height for svg
    const parentContainer = document.getElementById("data-visualization");
    let parentStyle = window.getComputedStyle(parentContainer);
    let parentPadding = parseFloat(parentStyle.paddingLeft) + parseFloat(parentStyle.paddingRight);

    const svg_width = parentContainer.offsetWidth - parentPadding;
    const svg_height = window.innerHeight / 1.2;

    // clean existing chart and warning if present
    cleanElement("chart");
    cleanElement("warning");

    // check for required data, and parameters before generating chart
    if (data == null) {
        warningAlert();
        return;
    }

    for (let key in parameters) {
        if (parameters[key] === null) {
            warningAlert();
            return;
        }
    }

    // filter data based on selected parameters
    const filtered_data = data.filter(row => row["LocationAbbr"] === parameters.state)
        .filter(row => row["Class"] === parameters.topic)
        .filter(row => row["Question"] === parameters.question)
        .filter(row => row["StratificationCategory1"] === parameters.demographic)
        .filter(row => row.Data_Value !== "")
        .sort((a, b) => a.YearStart - b.YearStart);

    // setup svg
    let svg = d3.select("#data-visualization")
        .append("svg")
        .attr("id", "chart")
        .attr("width", svg_width)
        .attr("height", svg_height)
        .append("g")
        .attr("transform", "translate(" + 60 + ",10)"),
        marginTop = 100,
        marginBottom = 250,
        width = svg_width - marginTop,
        height = svg_height - marginBottom

    // scale for mapping data points x-axis
    let xScale = d3.scaleBand()
        .domain(filtered_data.map(d => d["YearStart"]))
        .range([0, width]);

    let minPercentVal = d3.min(filtered_data, function (d) { return d.Data_Value; });
    let maxPercentVal = d3.max(filtered_data, function (d) { return d.Data_Value; });
    let minDomain = parseFloat(minPercentVal) <= 3 ? parseFloat(minPercentVal) : (parseFloat(minPercentVal) - 4)
    let maxDomain = parseFloat(maxPercentVal) >= 97 ? parseFloat(maxPercentVal) : (parseFloat(maxPercentVal) + 4)

    // scale for mapping data points on y-axis
    let yScale = d3.scaleLinear()
        .domain([minDomain, maxDomain])
        .range([height, 0]);

    // create circles for the datapoints on the chart
    svg.append("g")
        .selectAll("dot")
        .data(filtered_data)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return xScale(d.YearStart) + xScale.bandwidth() / 2; })
        .attr("cy", function (d) { return yScale(d.Data_Value); })
        .attr("r", 3)
        .style("fill", "#237dea");

    // create multi-line
    let uniqueDemographicCategory = getUniqueColumnData(filtered_data, "Stratification1")
    // color scale based on the unique demographic categories
    let colorScale = d3.scaleOrdinal()
        .domain(uniqueDemographicCategory)
        .range(d3.schemeCategory10)
    let line = d3.line()
        .x(d => xScale(d.YearStart) + xScale.bandwidth() / 2)
        .y(d => yScale(d.Data_Value))
        .curve(d3.curveMonotoneX);

    // create line path for the datapoints of each demographic category
    uniqueDemographicCategory.forEach(category => {
        svg.append("path")
            .datum(filtered_data.filter(row => row["Stratification1"] === category))
            .attr("d", line)
            .style("stroke", colorScale(category))
            .style("stroke-width", 2)
            .style("fill", "transparent");
    })

    // create axis
    svg.append("g")
        .attr("transform", "translate(" + 0 + "," + height + ")")
        .call(d3.axisBottom(xScale));
    svg.append("g")
        .call(d3.axisLeft(yScale));

    // write text describing the axis
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", svg_height - (marginBottom - 50))
        .attr("text-anchor", "middle")
        .text("Year");
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "translate(" + (-30) + "," + (height / 2) + ") rotate(-90)")
        .text("Percent");

    // create annotations
    let lowest_data = filtered_data.filter(row => row["Data_Value"] == minPercentVal)[0],
        lowest_x = xScale(lowest_data.YearStart) + xScale.bandwidth() / 2,
        lowest_y = yScale(lowest_data.Data_Value);

    let highest_data = filtered_data.filter(row => row["Data_Value"] == maxPercentVal)[0],
        highest_x = xScale(highest_data.YearStart) + xScale.bandwidth() / 2,
        highest_y = yScale(highest_data.Data_Value);

    // creating annotations for lowest and highest values
    const annotations = [
        {
            note: {
                label: minPercentVal,
                title: "Lowest"
            },
            color: ["#237dea"],
            x: lowest_x,
            y: lowest_y,
            dx: lowest_x > width / 2 ? -20 : 20,
            dy: lowest_y > height / 2 ? 20 : -20,
        },
        {
            note: {
                label: maxPercentVal,
                title: "Highest"
            },
            color: ["#237dea"],
            x: highest_x,
            y: highest_y,
            dx: highest_x > width / 2 ? -20 : 20,
            dy: highest_y > height / 2 ? 20 : -20,
        }
    ];

    const makeAnnotations = d3.annotation()
        .type(d3.annotationLabel)
        .annotations(annotations)
    svg.append("g")
        .attr("class", "annotation-group")
        .call(makeAnnotations)

    // create legend of line colors
    let legend = svg.selectAll("legends")
        .data(colorScale.domain())
        .enter()
        .append("g")
        .attr("transform", function (d, i) { return "translate(" + 0 + "," + (height + 80 + (i * 20)) + ")"; });
    legend
        .append("rect")
        .attr("width", 40)
        .attr("height", 6)
        .style("fill", (d) => colorScale(d));
    legend
        .append("text")
        .attr("x", 60)
        .attr("y", 8)
        .text((d) => d);
}

async function loadData() {
    data = await d3.csv(data_file);
    const states = getUniqueColumnData(data, "LocationAbbr");
    const topics = getUniqueColumnData(data, "Class");
    const demographics = getUniqueColumnData(data, "StratificationCategory1");

    const getQuestions = (selectedListElement) => {
        return getUniqueColumnData(getFilteredData(data, "Class", selectedListElement), "Question");
    }

    addDropDownList("State", "state", states);
    addList("Topic", "topic", topics, getQuestions);
    addList("Demographic", "demographic", demographics);

    lineChart(data);
}

loadData();
